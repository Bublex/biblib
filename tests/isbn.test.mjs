import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIsbn13, toIsbn10, normalizeIsbns, isValidIsbn10, isValidIsbn13 } from '../extension/lib/isbn.js';

test('valide les ISBN-10 et ISBN-13', () => {
  assert.ok(isValidIsbn10('2070612759'));
  assert.ok(isValidIsbn10('080442957X'));
  assert.ok(!isValidIsbn10('2070612758'));
  assert.ok(isValidIsbn13('9782070612758'));
  assert.ok(!isValidIsbn13('9782070612759'));
});

test('convertit vers ISBN-13 quelle que soit la présentation', () => {
  assert.equal(toIsbn13('2070612759'), '9782070612758');
  assert.equal(toIsbn13('978-2-07-061275-8'), '9782070612758');
  assert.equal(toIsbn13('978-2070612758'), '9782070612758');
  assert.equal(toIsbn13('isbn:978-2070-61-2758'), '9782070612758');
  assert.equal(toIsbn13('123'), null);
  assert.equal(toIsbn13(''), null);
});

test('convertit vers ISBN-10 (préfixe 978 seulement)', () => {
  assert.equal(toIsbn10('9782070612758'), '2070612759');
  assert.equal(toIsbn10('9791097878764'), null);
});

test('normalise et dédoublonne une liste', () => {
  assert.deepEqual(normalizeIsbns(['2070612759', '9782070612758', 'nimporte', '9782253006329']), ['9782070612758', '9782253006329']);
});
