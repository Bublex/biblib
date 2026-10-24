// Décodage windows-1252, que l'Encoding Standard applique aussi aux étiquettes « iso-8859-1 » et « latin1 ».
// Le TextDecoder de Hermes ne connaît que l'UTF-8, or Toulouse sert ses pages en ISO-8859-1.

const LABELS = new Set([
  'windows-1252', 'cp1252', 'x-cp1252', 'iso-8859-1', 'iso8859-1', 'iso88591', 'iso_8859-1', 'iso_8859-1:1987',
  'iso-ir-100', 'latin1', 'l1', 'csisolatin1', 'ibm819', 'cp819', 'ascii', 'us-ascii', 'ansi_x3.4-1968',
]);

// Octets 0x80 à 0x9F : seule différence entre windows-1252 et Latin-1 (les cases vides gardent leur valeur).
const HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

export const isSingleByteLabel = (label) => LABELS.has(String(label).trim().toLowerCase());

export function decodeWindows1252(input) {
  const bytes = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    out += String.fromCharCode(...Array.from(chunk, (b) => (b >= 0x80 && b <= 0x9f ? HIGH[b - 0x80] : b)));
  }
  return out;
}
