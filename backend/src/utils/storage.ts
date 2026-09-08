import { supabase } from './supabase';

const BUCKET_NAME = 'valentine-photos';

export async function ensureStorageBucket(): Promise<void> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
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

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const fileName = `${pairId}/${crypto.randomUUID()}.${ext}`;
  const contentType = `image/${matches[1] === 'jpeg' ? 'jpeg' : matches[1]}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return data.publicUrl;
}
