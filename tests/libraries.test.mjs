// Cohérence du registre des bibliothèques avec le manifeste et les connecteurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIBRARIES, originPatterns, libraryMeta } from '../extension/lib/libraries.js';
import { getConnector } from '../extension/lib/connectors/index.js';

const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

test('identifiants uniques', () => {
  const ids = LIBRARIES.map((l) => l.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('chaque catalogue figure dans les autorisations optionnelles du manifeste', () => {
  const declared = new Set(manifest.optional_host_permissions);
  const missing = LIBRARIES.flatMap(originPatterns).filter((origin) => !declared.has(origin));
  assert.deepEqual(missing, []);
});

test('le manifeste ne demande pas d’accès à un catalogue inconnu', () => {
  const used = new Set(LIBRARIES.flatMap(originPatterns));
  assert.deepEqual(manifest.optional_host_permissions.filter((origin) => !used.has(origin)), []);
});

test('les pages de suggestion d’achat sont des adresses web transmises à l’interface', () => {
  const withSuggest = LIBRARIES.filter((l) => l.suggestUrl);
  assert.ok(withSuggest.length > 0);
  for (const lib of withSuggest) {
    assert.match(lib.suggestUrl, /^https?:\/\//, lib.id);
    assert.equal(libraryMeta(lib).suggestUrl, lib.suggestUrl, lib.id);
  }
  assert.equal(libraryMeta(LIBRARIES.find((l) => l.id === 'bordeaux')).suggestUrl, null);
});

test('chaque entrée a un connecteur et les champs affichés', () => {
  for (const lib of LIBRARIES) {
    assert.ok(getConnector(lib.connector), lib.id);
    assert.ok(lib.name && lib.short && lib.city, lib.id);
    assert.doesNotThrow(() => new URL(lib.base), lib.id);
    if (lib.connector === 'syracuse') assert.ok(lib.scenario && lib.portal, lib.id);
  }
});
