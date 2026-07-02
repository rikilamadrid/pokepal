// Dependency-free PNG icon generator for PokéPal's PWA/native icon set.
// Draws an on-brand Pokéball on the dark brand background at every size the PWA
// needs, anti-aliased via 4x supersampling. Pure JS: only Node's zlib — the repo
// toolchain has no SVG rasterizer. Run with: `node scripts/generate-icons.js`.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.resolve(__dirname, "../public");
fs.mkdirSync(OUT, { recursive: true });

// Brand palette
const BG = [0x14, 0x15, 0x1a];
const BG_CENTER = [0x26, 0x29, 0x34];
const RED = [0xff, 0x46, 0x55];
const CREAM = [0xf5, 0xf3, 0xec];
const BLACK = [0x10, 0x11, 0x16];
const EDGE = [0x0b, 0x0c, 0x10];
const WHITE = [0xff, 0xff, 0xff];

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Color at a point (analytic; averaged over supersamples for anti-aliasing).
function sample(x, y, size, ratio, transparentBg) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * ratio;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);

  if (d > R) {
    if (transparentBg) return null; // transparent outside the ball
    // subtle radial background
    const t = Math.min(1, Math.hypot(dx, dy) / (size * 0.72));
    return lerp(BG_CENTER, BG, t);
  }

  const bandHalf = R * 0.12;
  const buttonOuter = R * 0.3;
  const buttonInner = R * 0.18;
  const edge = R * 0.035;

  let c = dy < 0 ? RED : CREAM;
  if (Math.abs(dy) <= bandHalf) c = BLACK;
  if (d <= buttonOuter) c = BLACK;
  if (d <= buttonInner) c = WHITE;
  if (d >= R - edge) c = EDGE; // crisp rim
  return c;
}

function render(size, ratio, transparentBg) {
  const SS = 4; // supersample factor per axis
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          const c = sample(fx, fy, size, ratio, transparentBg);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = Math.round(a / n);
    }
  }
  return buf;
}

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, size, ratio, transparentBg = false) {
  const png = encodePng(render(size, ratio, transparentBg), size);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`wrote ${name} (${size}px, ${png.length} bytes)`);
}

// Reused by scripts/generate-native-assets.js to render Capacitor source assets.
module.exports = { render, encodePng, BG, BG_CENTER };

// Only emit the PWA icon set when run directly (`node scripts/generate-icons.js`).
if (require.main === module) {
  // "any" icons — tighter ball, dark bg
  write("icon-192.png", 192, 0.44);
  write("icon-512.png", 512, 0.44);
  // maskable — extra padding so the ball stays inside the 80% safe zone
  write("icon-192-maskable.png", 192, 0.34);
  write("icon-512-maskable.png", 512, 0.34);
  // apple touch icon — iOS masks corners itself; dark bg, medium padding
  write("apple-touch-icon.png", 180, 0.4);
  // favicon
  write("favicon.png", 48, 0.46);
  console.log("done");
}
