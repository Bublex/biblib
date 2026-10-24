// App mobile : décodage windows-1252 (pages ISO-8859-1 de Toulouse).
// Pas de comparaison avec le TextDecoder de Node 22 : il décode windows-1252 comme du Latin-1 pur (0x80 ≠ €).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeWindows1252, isSingleByteLabel } from '../mobile/src/encoding.js';

test('octets décodés comme par un navigateur', () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  const text = decodeWindows1252(bytes);
  assert.equal(text.length, 256);
  for (let i = 0; i < 256; i++) if (i < 0x80 || i >= 0xa0) assert.equal(text.charCodeAt(i), i, `0x${i.toString(16)}`);
  assert.equal(text[0x80], '€');
  assert.equal(text[0x92], '’');
  assert.equal(text[0x9c], 'œ');
  assert.equal(text[0x9f], 'Ÿ');
  assert.equal(text[0x81], '\u0081');
});

test('accepte ArrayBuffer et vues partielles', () => {
  const page = Uint8Array.from([0x50, 0x72, 0xea, 0x74, 0xe9, 0x80]);
  assert.equal(decodeWindows1252(page.buffer), 'Prêté€');
  assert.equal(decodeWindows1252(page.subarray(2, 5)), 'êté');
});

test('étiquettes reconnues', () => {
  for (const label of ['ISO-8859-1', 'latin1', 'windows-1252', ' iso-8859-1 ']) assert.ok(isSingleByteLabel(label), label);
  assert.ok(!isSingleByteLabel('utf-8'));
});
