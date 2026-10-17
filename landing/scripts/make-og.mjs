// Generates the landing's Open Graph image and app icon as PNGs with zero
// dependencies (Node's built-in zlib). Run:  node scripts/make-og.mjs
//
// The heart is the classic implicit curve (x^2+y^2-1)^3 - x^2 y^3 = 0, filled
// with 2x2 supersampling so the edges are smooth without any image library.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets');
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const BG_TOP = hex(0x1a131b);
const BG_BOTTOM = hex(0x2c2030);
const RED = hex(0xe60023);
const RED_TOP = hex(0xff8a97);

function heartInside(nx, ny) {
  const p = nx * nx + ny * ny - 1;
  return p * p * p - nx * nx * ny * ny * ny <= 0;
}

function render(width, height, opts) {
  const { scale, cx, cy, bg, glow, stars } = opts;
  const rgb = Buffer.alloc(width * height * 3);
  const rnd = mulberry32(7);

  const starField = Array.from({ length: stars }, () => ({
    x: rnd() * width,
    y: rnd() * height,
    r: 0.6 + rnd() * 1.4,
    a: 0.15 + rnd() * 0.5,
  }));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Background: vertical gradient + soft radial red glow.
      const ty = y / (height - 1);
      let r = mix(bg[0], bg[3], ty);
      let g = mix(bg[1], bg[4], ty);
      let b = mix(bg[2], bg[5], ty);

      const gd = Math.hypot(x - cx, y - cy) / (Math.max(width, height) * glow.spread);
      const gi = Math.max(0, 1 - gd) ** 2 * glow.strength;
      r = mix(r, RED[0], gi);
      g = mix(g, RED[1], gi);
      b = mix(b, RED[2], gi);

      // 2x2 supersampled heart coverage.
      let cov = 0;
      let topSum = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) / 2;
          const py = y + (sy + 0.5) / 2;
          const nx = (px - cx) / scale;
          const ny = (cy - py) / scale;
          if (heartInside(nx, ny)) {
            cov += 0.25;
            topSum += clamp01((ny + 1.2) / 2.2);
          }
        }
      }
      if (cov > 0) {
        const top = cov > 0 ? topSum / (cov * 4) : 0;
        const hr = mix(RED[0], RED_TOP[0], top);
        const hg = mix(RED[1], RED_TOP[1], top);
        const hb = mix(RED[2], RED_TOP[2], top);
        r = mix(r, hr, cov);
        g = mix(g, hg, cov);
        b = mix(b, hb, cov);
      }

      const i = (y * width + x) * 3;
      rgb[i] = Math.round(r);
      rgb[i + 1] = Math.round(g);
      rgb[i + 2] = Math.round(b);
    }
  }

  // Stars on top.
  for (const s of starField) {
    const x0 = Math.floor(s.x);
    const y0 = Math.floor(s.y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const d = Math.hypot(dx, dy);
        if (d > s.r + 1) continue;
        const a = clamp01((s.r + 1 - d) / (s.r + 1)) * s.a;
        const i = (y * width + x) * 3;
        rgb[i] = Math.round(mix(rgb[i], 255, a));
        rgb[i + 1] = Math.round(mix(rgb[i + 1], 240, a));
        rgb[i + 2] = Math.round(mix(rgb[i + 2], 255, a));
      }
    }
  }

  return rgb;
}

const og = render(1200, 630, {
  scale: 150,
  cx: 600,
  cy: 320,
  bg: [BG_TOP[0], BG_TOP[1], BG_TOP[2], BG_BOTTOM[0], BG_BOTTOM[1], BG_BOTTOM[2]],
  glow: { spread: 0.5, strength: 0.5 },
  stars: 90,
});
writeFileSync(join(OUT, 'og-image.png'), encodePng(1200, 630, og));

const icon = render(192, 192, {
  scale: 62,
  cx: 96,
  cy: 96,
  bg: [BG_TOP[0], BG_TOP[1], BG_TOP[2], BG_BOTTOM[0], BG_BOTTOM[1], BG_BOTTOM[2]],
  glow: { spread: 0.9, strength: 0.35 },
  stars: 24,
});
writeFileSync(join(OUT, 'icon-192.png'), encodePng(192, 192, icon));

console.log('Wrote assets/og-image.png (1200x630) and assets/icon-192.png (192x192)');
