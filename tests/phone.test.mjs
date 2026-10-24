// Modèles d'adresse du raccourci téléphone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARIES, getLibrary } from '../extension/lib/libraries.js';
import { phoneTemplate, PLACEHOLDER } from '../extension/lib/phone.js';

test('Syracuse : l’ISBN termine l’adresse de recherche', () => {
  assert.equal(phoneTemplate(getLibrary('merignac')), 'https://www.mediatheque.merignac.com/Default/search.aspx?SC=DEFAULT&QUERY={RESULT}');
  assert.equal(phoneTemplate(getLibrary('paris')), 'https://bibliotheques.paris.fr/Default/search.aspx?SC=CATALOGUE&QUERY={RESULT}');
});

test('Encore : l’ISBN est au milieu de l’adresse', () => {
  const template = phoneTemplate(LIBRARIES.find((l) => l.connector === 'encore'));
  assert.match(template, /\/iii\/encore\/search\/C__S\{RESULT\}__Orightresult__U\?lang=frf$/);
});

test('inMedia : pas d’adresse de recherche publique, donc pas de raccourci', () => {
  assert.equal(phoneTemplate(getLibrary('bordeaux')), null);
  assert.equal(phoneTemplate(getLibrary('lyon')), null);
});

test('les autres réseaux ont un modèle valide, avec l’ISBN une seule fois', () => {
  for (const lib of LIBRARIES.filter((l) => l.connector !== 'inmedia')) {
    const template = phoneTemplate(lib);
    assert.equal(template.split(PLACEHOLDER).length, 2, lib.id);
    assert.doesNotThrow(() => new URL(template.replace(PLACEHOLDER, '9782070368228')), lib.id);
  }
});
