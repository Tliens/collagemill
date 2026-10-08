// CollageMill · 蜃楼 placeholder logo — pure-Node PNG rasterizer (no deps)
// Renders 512px, box-downscales to logo.png 256 / favicon.png 64 / apple-touch-icon.png 180
// Rounded corners 20% transparent (workspace rule). Re-run: node scripts/gen-logo.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const S = 512, R = S * 0.2; // corner radius 20%
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * t);

// signed distance to rounded rect
function sdRR(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

const img = new Float64Array(S * S * 4);

// ---- background: vertical gradient #0d1a2e -> #0a101e + teal glow top-center
const bgA = hex('#0e1c33'), bgB = hex('#090f1d');
const glow = hex('#2ab5a5');
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const i = (y * S + x) * 4;
  let c = mix(bgA, bgB, y / S);
  const g = Math.max(0, 1 - Math.hypot((x - S * .5) / (S * .55), (y - S * .18) / (S * .45)));
  c = mix(c, glow, g * g * .22);
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
}

// ---- paste rounded-tile helper: draws a rounded rect with vertical gradient + soft edge
function tile(cx, cy, hw, hh, r, colA, colB, alpha = 1) {
  for (let y = Math.max(0, cy - hh - 2) | 0; y < Math.min(S, cy + hh + 3); y++) for (let x = Math.max(0, cx - hw - 2) | 0; x < Math.min(S, cx + hw + 3); x++) {
    const d = sdRR(x + .5, y + .5, cx, cy, hw, hh, r);
    const a = clamp(.5 - d, 0, 1); // ~1px AA
    if (a <= 0) continue;
    const i = (y * S + x) * 4;
    const c = mix(colA, colB, (y - (cy - hh)) / (2 * hh));
    img[i] = img[i] * (1 - a * alpha) + c[0] * a * alpha;
    img[i + 1] = img[i + 1] * (1 - a * alpha) + c[1] * a * alpha;
    img[i + 2] = img[i + 2] * (1 - a * alpha) + c[2] * a * alpha;
    img[i + 3] = Math.max(img[i + 3], 255 * a * alpha);
  }
}
// shimmer gradient tile (the mirage tile): teal -> violet -> gold sweep, plus glow
function mirageTile(cx, cy, hw, hh, r) {
  const t1 = hex('#45d4c8'), t2 = hex('#8b7cf6'), t3 = hex('#e8c468');
  const gx0 = cx - hw, gy0 = cy - hh;
  for (let y = Math.max(0, cy - hh - 14) | 0; y < Math.min(S, cy + hh + 15); y++) for (let x = Math.max(0, cx - hw - 14) | 0; x < Math.min(S, cx + hw + 15); x++) {
    const d = sdRR(x + .5, y + .5, cx, cy, hw, hh, r);
    const a = clamp(.5 - d, 0, 1);
    const u = (x - gx0) / (2 * hw), v = (y - gy0) / (2 * hh);
    const s = clamp((u + v) / 2, 0, 1);
    let c = s < .5 ? mix(t1, t2, s * 2) : mix(t2, t3, (s - .5) * 2);
    // shimmer stripes
    const sh = Math.sin((u * 6 + v * 2.4) * Math.PI) * .5 + .5;
    c = mix(c, [255, 255, 255], sh * .18);
    const i = (y * S + x) * 4;
    if (a > 0) {
      img[i] = img[i] * (1 - a) + c[0] * a;
      img[i + 1] = img[i + 1] * (1 - a) + c[1] * a;
      img[i + 2] = img[i + 2] * (1 - a) + c[2] * a;
      img[i + 3] = Math.max(img[i + 3], 255 * a);
    } else if (d < 14) { // outer glow
      const g = (1 - d / 14) * .3;
      img[i] = img[i] * (1 - g) + c[0] * g;
      img[i + 1] = img[i + 1] * (1 - g) + c[1] * g;
      img[i + 2] = img[i + 2] * (1 - g) + c[2] * g;
    }
  }
}

// ---- 2x2 collage grid, top-right tile is the mirage
const gap = S * .045, pad = S * .19;
const cell = (S - pad * 2 - gap) / 2;
const pos = [[pad, pad], [pad + cell + gap, pad], [pad, pad + cell + gap], [pad + cell + gap, pad + cell + gap]];
const radius = S * .055;
// three quiet photo-ish tiles (night teal / deep violet / sand)
tile(pos[0][0] + cell / 2, pos[0][1] + cell / 2, cell / 2, cell / 2, radius, hex('#1d4b57'), hex('#123240'), 1);
tile(pos[1][0] + cell / 2, pos[1][1] + cell / 2, cell / 2, cell / 2, radius, hex('#2c2350'), hex('#1c1838'), 1); // <- replaced by mirage below
tile(pos[2][0] + cell / 2, pos[2][1] + cell / 2, cell / 2, cell / 2, radius, hex('#4a3b22'), hex('#2e2a1c'), 1);
mirageTile(pos[1][0] + cell / 2, pos[1][1] + cell / 2, cell / 2, cell / 2, radius);
// bottom-right tile keeps darker to suggest another photo; add subtle inner highlight line on all
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const i = (y * S + x) * 4;
  const d = sdRR(x + .5, y + .5, pos[3][0] + cell / 2, pos[3][1] + cell / 2, cell / 2, cell / 2, radius);
  if (d > -1 && d < 3) { // faint rim
    img[i] = img[i] * .82 + 90 * .18; img[i + 1] = img[i + 1] * .82 + 110 * .18; img[i + 2] = img[i + 2] * .82 + 120 * .18;
  }
}
tile(pos[3][0] + cell / 2, pos[3][1] + cell / 2, cell / 2 - 3, cell / 2 - 3, radius - 2, hex('#101d2e'), hex('#0b1420'), 1);

// ---- round the whole canvas (20% corners, transparent outside)
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const d = sdRR(x + .5, y + .5, S / 2, S / 2, S / 2, S / 2, R);
  const a = clamp(.5 - d, 0, 1);
  const i = (y * S + x) * 4;
  img[i + 3] *= a;
}

// ---- box downscale
function downscale(target) {
  const f = S / target, out = new Uint8Array(target * target * 4);
  for (let y = 0; y < target; y++) for (let x = 0; x < target; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < f; sy++) for (let sx = 0; sx < f; sx++) {
      const i = (((y * f + sy) | 0) * S + ((x * f + sx) | 0)) * 4;
      const al = img[i + 3] / 255;
      r += img[i] * al; g += img[i + 1] * al; b += img[i + 2] * al; a += img[i + 3];
    }
    const n = f * f, o = (y * target + x) * 4;
    const al = a / (255 * n);
    out[o] = al > 0 ? r / (a || 1) * 255 : 0;
    out[o + 1] = al > 0 ? g / (a || 1) * 255 : 0;
    out[o + 2] = al > 0 ? b / (a || 1) * 255 : 0;
    out[o + 3] = a / n;
  }
  return out;
}

// ---- PNG encode
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return buf => { let c = -1; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(px, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(new URL('../', import.meta.url), { recursive: true });
const base = new URL('../', import.meta.url);
for (const [name, size] of [['logo.png', 256], ['favicon.png', 64], ['apple-touch-icon.png', 180]]) {
  const buf = encodePNG(downscale(size), size, size);
  writeFileSync(new URL(name, base), buf);
  console.log(name, size + 'px', (buf.length / 1024).toFixed(1) + 'KB');
}
console.log('done — 蜃楼 placeholder assets (rounded 20%, ?v=1)');
