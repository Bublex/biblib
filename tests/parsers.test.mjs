// Analyse de vraies pages de catalogues enregistrées (Toulouse « Web2 », Rennes « Encore »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWeb2 } from '../extension/lib/connectors/web2.js';
import { parseEncore } from '../extension/lib/connectors/encore.js';
import { getLibrary } from '../extension/lib/libraries.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Toulouse : notice détaillée avec tableau des exemplaires', () => {
  const [record, ...rest] = parseWeb2(getLibrary('toulouse'), fixture('toulouse-notice.html'), '9782070612758');
  assert.equal(rest.length, 0);
  assert.equal(record.title, 'Le petit Prince');
  assert.match(record.author, /Saint-Exup/);
  assert.equal(record.year, '2007');
  assert.match(record.url, /^http:\/\/catalogues\.toulouse\.fr\/web2\/tramp2\.exe\/do_keyword_search/);
  assert.equal(record.items.length, 6);
  // La page indique « 4 exemplaire(s) disponible(s) sur 6 ».
  assert.equal(record.items.filter((i) => i.available).length, 4);
  const lent = record.items.find((i) => i.branch === 'Médiathèque José Cabanis' && !i.available);
  assert.equal(lent.dueDate, '2026-10-29');
  assert.match(lent.status, /Prêté/);
});

test('Toulouse : liste de résultats avec comptes et ISBN cachés', () => {
  const records = parseWeb2(getLibrary('toulouse'), fixture('toulouse-liste.html'), 'petit prince saint-exupery');
  assert.ok(records.length >= 10, `${records.length} notices`);
  const first = records[0];
  assert.match(first.title, /plus belles histoires de princes/);
  assert.deepEqual(first.counts, { available: 0, total: 1 });
  assert.deepEqual(first.isbns, ['9782070659241']);
  const withBranches = records.find((r) => r.items.length);
  assert.ok(withBranches.items.every((i) => i.branch && !i.branch.includes('and')));
});

test('Rennes : une notice et ses exemplaires', () => {
  const records = parseEncore(getLibrary('rennes'), fixture('rennes-un-resultat.html'));
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.id, 'b1986235');
  assert.equal(record.title, 'Harry Potter à l\'école des sorciers');
  assert.match(record.author, /Rowling/);
  assert.equal(record.url, 'https://opac.si.leschampslibres.fr/iii/encore/record/C__Rb1986235?lang=frf');
  assert.deepEqual(record.isbns, ['9782070584628']);
  assert.ok(record.items.length >= 1);
  assert.equal(record.items[0].available, false);
  assert.match(record.items[0].status, /TRANSIT/);
});

test('Rennes : liste et absence de résultat', () => {
  assert.equal(parseEncore(getLibrary('rennes'), fixture('rennes-liste.html')).length, 3);
  assert.equal(parseEncore(getLibrary('rennes'), fixture('rennes-aucun.html')).length, 0);
});
