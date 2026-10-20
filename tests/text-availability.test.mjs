import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, stripTags, cleanRecordTitle, titleSimilarity, lastName, authorAppears } from '../extension/lib/text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../extension/lib/availability.js';
import { isSameWork, overallStatus } from '../extension/lib/lookup.js';

test('décode les entités HTML', () => {
  assert.equal(decodeEntities('M&eacute;diath&egrave;que &amp; Cie&nbsp;!'), 'Médiathèque & Cie !');
  assert.equal(decodeEntities('&#233;t&#xE9;'), 'été');
  assert.equal(stripTags('<td>Prêté&nbsp;<!-- commentaire --></td>'), 'Prêté');
});

test('nettoie les titres de notices', () => {
  assert.equal(cleanRecordTitle('Le petit prince [Livre] / Antoine de Saint-Exupéry'), 'Le petit prince');
  assert.equal(cleanRecordTitle('Le petit Prince /'), 'Le petit Prince');
  assert.equal(cleanRecordTitle(". Harry Potter à l'école des sorciers /1"), "Harry Potter à l'école des sorciers (1)");
  assert.equal(cleanRecordTitle("Harry Potter à l'école des sorciers / J. K. Rowling ; traduit de l'anglais"), "Harry Potter à l'école des sorciers");
});

test('compare les titres et les auteurs', () => {
  assert.equal(titleSimilarity('LE PETIT PRINCE', 'Le Petit prince'), 1);
  assert.ok(titleSimilarity('Le petit prince', "La belle histoire du Petit Prince d'Antoine de Saint-Exupéry") < 0.6);
  assert.equal(lastName('Antoine de Saint-Exupéry'), 'Saint-Exupéry');
  assert.equal(lastName('Rowling, J. K. (1965-....)'), 'Rowling');
  assert.ok(authorAppears('Antoine de Saint-Exupéry', 'Saint-Exupery, Antoine de (1900-1944)'));
  assert.ok(!authorAppears('Alain Damasio', 'Saint-Exupéry, Antoine de'));
});

test('reconnaît la même œuvre trouvée par titre', () => {
  const book = { title: 'La Horde du Contrevent', authors: ['Alain Damasio'] };
  assert.ok(isSameWork(book, { title: 'La horde du contrevent', author: 'Damasio, Alain (1969-....)' }));
  assert.ok(!isSameWork(book, { title: 'La horde du contrevent', author: 'Dupont, Jean' }));
  assert.ok(isSameWork(book, { title: 'La horde du contrevent', author: '' }));
  assert.ok(!isSameWork(book, { title: 'La zone du dehors', author: 'Damasio, Alain' }));
  const bd = { title: 'Génie, Vidi, Vici', series: 'Génial Olivier', authors: ['Jacques Devos'] };
  assert.ok(isSameWork(bd, { title: 'Génial Olivier. 3, Génie, vidi, vici', author: 'Devos, Jacques' }));
});

test('interprète les statuts d’exemplaires des différents catalogues', () => {
  const cases = {
    Disponible: true,
    'En rayon': true,
    'EN RAYON': true,
    'en rayon': true,
    'Prêté (Retour prévu le : 20/10/2026)': false,
    'En retard (Retour prévu le : 01/08/2024)': false,
    Sorti: false,
    Emprunté: false,
    'EN TRANSIT +2 RÉSERVATIONS': false,
    'À transférer (CAU => ARG)': false,
    'Retour prévu le 24/10/2026': false,
    'En cours de consultation sur place': false,
    'Exclu du prêt': true,
    'Non disponible': false,
    '': null,
    '.': null,
  };
  for (const [status, expected] of Object.entries(cases)) assert.equal(classifyStatus(status), expected, status);
  assert.ok(isOnSiteOnly('Livre à consulter sur place'));
  assert.ok(!isOnSiteOnly('Livre empruntable'));
  assert.equal(parseFrenchDate('Prêté (Retour prévu le : 7/11/2026)'), '2026-11-07');
  assert.equal(parseFrenchDate('Disponible'), null);
});

test('résume l’état d’une bibliothèque', () => {
  assert.equal(overallStatus([]), 'absent');
  assert.equal(overallStatus([{ availableCount: 0, totalCount: 3 }]), 'unavailable');
  assert.equal(overallStatus([{ availableCount: 0, totalCount: 3 }, { availableCount: 1, totalCount: 1 }]), 'available');
  assert.equal(overallStatus([{ availableCount: 0, totalCount: 0 }]), 'unknown');
});
