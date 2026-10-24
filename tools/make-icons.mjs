// Génère les icônes PNG de l'extension (16, 32, 48, 128 px) et de l'app mobile, sans dépendance :
// rastérisation par sur-échantillonnage + encodeur PNG minimal (zlib de Node).
// Usage : node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../extension/icons/', import.meta.url));
const MOBILE = fileURLToPath(new URL('../mobile/assets/', import.meta.url));

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BLUE = hex('#284b8f');
const WHITE = [255, 255, 255];
const GREEN = hex('#2fbf71');

function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// Livre ouvert (deux pages) + pastille verte « disponible ».
const LEFT_PAGE = [[0.18, 0.27], [0.47, 0.34], [0.47, 0.76], [0.18, 0.69]];
const RIGHT_PAGE = [[0.53, 0.34], [0.82, 0.27], [0.82, 0.69], [0.53, 0.76]];

// Calques : « tile » (carré arrondi, extension), « full » (carré plein : iOS arrondit lui-même),
// « glyph » (dessin sur fond transparent, premier plan Android), « mono » (silhouette blanche), « bg » (fond seul).
function sample(x, y, layer = 'tile') {
  if (layer === 'bg') return BLUE;
  if (layer === 'tile' && !inRoundedRect(x, y, 0.22)) return null;
  const background = layer === 'tile' || layer === 'full' ? BLUE : null;
  if (inCircle(x, y, 0.76, 0.76, 0.15)) return layer === 'mono' ? WHITE : GREEN;
  if (inCircle(x, y, 0.76, 0.76, 0.2)) return layer === 'mono' ? null : BLUE;
  if (inPolygon(x, y, LEFT_PAGE) || inPolygon(x, y, RIGHT_PAGE)) return WHITE;
  return background;
}

// pad : marge transparente (le Chrome Web Store veut un dessin de 96 px dans une icône de 128 px).
function render(size, pad = 0, layer = 'tile', ss = 6) {
  const px = Buffer.alloc(size * size * 4);
  const art = size - 2 * pad;
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (pxi - pad + (sx + 0.5) / ss) / art;
          const y = (py - pad + (sy + 0.5) / ss) / art;
          const c = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? sample(x, y, layer) : null;
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a++;
        }
      }
      const o = (py * size + pxi) * 4;
      if (a) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
      }
      px[o + 3] = Math.round((255 * a) / (ss * ss));
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// opaque : sans canal alpha (l'App Store refuse une icône d'app qui en a un).
function png(size, rgba, { opaque = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = opaque ? 2 : 6; // RGB ou RGBA
  const bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc((size * bpp + 1) * size);
  for (let i = 0; i < size * size; i++) {
    const row = Math.floor(i / size);
    rgba.copy(raw, row * (size * bpp + 1) + 1 + (i % size) * bpp, i * 4, i * 4 + bpp);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [size, pad] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
  writeFileSync(`${OUT}icon${size}.png`, png(size, render(size, pad)));
  console.log(`icons/icon${size}.png`);
}

// App mobile (Expo) : icône iOS, écran de lancement, icône adaptative Android, favicon web.
const MOBILE_ICONS = [
  ['icon.png', 1024, 0, 'full', { opaque: true }],
  ['splash-icon.png', 1024, 0, 'tile'],
  ['android-icon-foreground.png', 512, 64, 'glyph'],
  ['android-icon-background.png', 512, 0, 'bg', { opaque: true }],
  ['android-icon-monochrome.png', 432, 54, 'mono'],
  ['favicon.png', 48, 0, 'tile'],
];
mkdirSync(MOBILE, { recursive: true });
for (const [name, size, pad, layer, options] of MOBILE_ICONS) {
  writeFileSync(`${MOBILE}${name}`, png(size, render(size, pad, layer, size > 128 ? 3 : 6), options));
  console.log(`mobile/assets/${name}`);
}
