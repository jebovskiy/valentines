import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectImageType } from '../src/utils/storage';

test('storage: detects a JPEG by magic bytes', () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.deepEqual(detectImageType(jpg), { ext: 'jpg', mime: 'image/jpeg' });
});

test('storage: detects a PNG by magic bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.deepEqual(detectImageType(png), { ext: 'png', mime: 'image/png' });
});

test('storage: detects a WebP only when RIFF....WEBP header is present', () => {
  const riff = Buffer.from('RIFF');
  const webp = Buffer.from('WEBP');
  const header = Buffer.concat([riff, Buffer.from([0x00, 0x00, 0x00, 0x00]), webp]);
  assert.deepEqual(detectImageType(header), { ext: 'webp', mime: 'image/webp' });
});

test('storage: rejects a fake WebP (RIFF without the WEBP marker)', () => {
  const riff = Buffer.from('RIFF');
  const avif = Buffer.from('AVIF');
  const header = Buffer.concat([riff, Buffer.from([0x00, 0x00, 0x00, 0x00]), avif]);
  assert.equal(detectImageType(header), null);
});

test('storage: rejects truncated and opaque buffers', () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8])), null);
  assert.equal(detectImageType(Buffer.from([0x00, 0x00, 0x00, 0x00])), null);
  assert.equal(detectImageType(Buffer.from([])), null);
});