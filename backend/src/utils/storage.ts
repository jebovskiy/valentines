import { supabase } from './supabase';
import Crypto from 'crypto';

const BUCKET_NAME = 'valentine-photos';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The first few bytes of a real JPEG / PNG / WebP file. Content-type sniffing
// alone is spoofable, so we validate magic bytes before upload.
const MAGIC_BYTES: Record<string, { magic: number[]; mime: string }> = {
  jpg: { magic: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  png: { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
  webp: { magic: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // "RIFF" — WebP verified via RIFF....WEBP header below
};

function matchesMagic(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  if (matchesMagic(buffer, MAGIC_BYTES.jpg.magic)) return { ext: 'jpg', mime: 'image/jpeg' };
  if (matchesMagic(buffer, MAGIC_BYTES.png.magic)) return { ext: 'png', mime: 'image/png' };
  if (matchesMagic(buffer, MAGIC_BYTES.webp.magic)) {
    // RIFF header must carry the "WEBP" stream marker at offset 8.
    if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return { ext: 'webp', mime: 'image/webp' };
    }
  }
  return null;
}

export async function ensureStorageBucket(): Promise<void> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_IMAGE_BYTES,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      console.log(`Created storage bucket: ${BUCKET_NAME}`);
    }
  } catch (err) {
    console.error('Failed to ensure storage bucket:', err);
  }
}

export async function uploadValentinePhoto(
  pairId: string,
  base64Data: string
): Promise<string> {
  const matches = base64Data.match(/^data:image\/([a-z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 image data');

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.byteLength === 0) throw new Error('Empty image data');
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image too large');

  // Trust the magic bytes, not the declared MIME in the data URL.
  const detected = detectImageType(buffer);
  if (!detected) throw new Error('Unsupported image format');

  const fileName = `${pairId}/${Crypto.randomUUID()}.${detected.ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType: detected.mime, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return data.publicUrl;
}
