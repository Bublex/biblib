// Résumé affiché dans la pastille (sans DOM : summarize ne fait que lire l'état).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLibrary, libraryMeta } from '../extension/lib/libraries.js';
import '../extension/content/ui.js';

const { summarize } = globalThis.BiblibUI;

const item = (branch, available = true) => ({ branch, available, status: available ? 'Disponible' : 'Prêté' });
const result = (libraryId, ...items) => ({
  libraryId,
  status: items.some((i) => i.available) ? 'available' : 'unavailable',
  records: [{ items, availableCount: items.filter((i) => i.available).length, totalCount: items.length }],
});
const state = (...results) => ({
  libraries: results.map((r) => libraryMeta(getLibrary(r.libraryId))),
  results: Object.fromEntries(results.map((r) => [r.libraryId, r])),
});

const bordeaux = result('bordeaux', item('Bacalan'), item('Grand Parc'), item('Caudéran', false));

test('Pastille : un réseau avec retrait au choix est nommé, pas son annexe', () => {
  assert.equal(summarize(state(bordeaux), {}).detail, 'Bordeaux, retrait au choix');
});

test('Pastille : une bibliothèque où l’emprunter directement passe avant le réseau à réserver', () => {
  const merignac = result('merignac', item('Médiathèque du Burck'));
  const s = summarize(state(bordeaux, merignac), {});
  assert.equal(s.title, 'Disponible');
  assert.equal(s.detail, 'Médiathèque du Burck et 1 autre');
});

test('Pastille : la bibliothèque favorite reste nommée, même dans un réseau avec retrait au choix', () => {
  const withFav = result('bordeaux', item('Bacalan'), item('Caudéran'));
  const s = summarize(state(withFav), { favorites: { bordeaux: ['Caudéran'] } });
  assert.equal(s.title, 'Disponible dans votre bibliothèque');
  assert.equal(s.detail, 'Caudéran');
});
