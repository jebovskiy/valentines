import { supabase } from './supabase';
import Crypto from 'crypto';

const BUCKET_NAME = 'valentine-photos';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Raised when user-supplied photo data is invalid — maps to HTTP 400, not 500. */
export class PhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoValidationError';
  }
}

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

export function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
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
        // Private: photos are couple-private and must not be readable by URL
        // guessing. The backend hands out short-lived signed URLs instead.
        public: false,
        fileSizeLimit: MAX_IMAGE_BYTES,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      console.log(`Created storage bucket: ${BUCKET_NAME}`);
    } else {
      // The bucket may predate the magic-byte/server-side checks and be created
      // without constraints — re-assert the limits so the bucket itself is the
      // first line of defense (server checks stay the second).
      const { error: updateError } = await supabase.storage.updateBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: MAX_IMAGE_BYTES,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (updateError) {
        console.warn(`Failed to update bucket constraints: ${updateError.message}`);
      }
      console.log(`Verified storage bucket: ${BUCKET_NAME}`);
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
  if (!matches) throw new PhotoValidationError('Invalid base64 image data');

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.byteLength === 0) throw new PhotoValidationError('Empty image data');
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new PhotoValidationError('Image too large');

  // Trust the magic bytes, not the declared MIME in the data URL.
  const detected = detectImageType(buffer);
  if (!detected) throw new PhotoValidationError('Unsupported image format');

  const fileName = `${pairId}/${Crypto.randomUUID()}.${detected.ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType: detected.mime, upsert: false });

  if (error) throw error;

  // Store the object path, not a URL: the bucket is private and the URL is
  // signed on read with a short TTL.
  return fileName;
}

/**
 * Normalises a stored photo reference (object path, or a legacy public URL
 * written before the bucket was made private) to an object path.
 */
function toObjectPath(stored: string): string | null {
  const marker = `/object/public/${BUCKET_NAME}/`;
  const idx = stored.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(stored.slice(idx + marker.length).split('?')[0]);
  if (/^https?:\/\//i.test(stored)) return null; // unknown external URL
  return stored;
}

/** Returns a short-lived signed URL for a stored photo reference. */
export async function resolvePhotoUrl(stored: string | null, ttlSeconds = 3600): Promise<string | null> {
  if (!stored) return null;
  const path = toObjectPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Signs many references in one storage round-trip (each `createSignedUrl` is an
 * HTTP call, so per-star signing would fan out hundreds of requests on a long
 * streak). Duplicates share one signature; returns URLs in the input order.
 */
export async function resolvePhotoUrls(
  stored: (string | null)[],
  ttlSeconds = 3600
): Promise<(string | null)[]> {
  const paths = stored.map((s) => (s ? toObjectPath(s) : null));
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const signed = new Map<string, string>();
  if (unique.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrls(unique, ttlSeconds);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
      }
    }
  }
  return paths.map((p) => (p ? signed.get(p) ?? null : null));
}

/** Signs the `photo_url` of every item in place (returns new objects). */
export async function withSignedPhotoUrls<T extends { photo_url: string | null }>(
  items: T[],
  ttlSeconds = 3600
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, photo_url: await resolvePhotoUrl(item.photo_url, ttlSeconds) }))
  );
}
