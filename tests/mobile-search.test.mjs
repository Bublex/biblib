// App mobile : recherche d'un livre scanné (ISBN puis repli par titre) et lecture de la réponse de la BnF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchBook, clearCache } from '../mobile/src/search.js';
import { parseBnf, bnfAuthor, bnfUrl } from '../mobile/src/bnf.js';

const lib = (id) => ({ id, name: id });
const record = (title, extra = {}) => ({ id: title, title, author: '', isbns: [], items: [], availableCount: 1, totalCount: 1, ...extra });

/** Faux lookupLibrary : les bibliothèques de `byIsbn` ont l'édition scannée, celles de `byTitle` une autre. */
function fakeLookup({ byIsbn = {}, byTitle = {} }) {
  const calls = [];
  const lookupLibrary = async (l, book) => {
    calls.push({ lib: l.id, isbns: book.isbns, title: book.title });
    const records = book.isbns.length ? byIsbn[l.id] || [] : byTitle[l.id] || [];
    for (const r of records) r.match = book.isbns.length ? 'isbn' : 'title';
    return { libraryId: l.id, status: records.length ? 'available' : 'absent', records, searchedBy: [book.isbns.length ? 'isbn' : 'title'] };
  };
  return { lookupLibrary, calls };
}

test('ISBN trouvé partout : pas de recherche de titre', async () => {
  clearCache();
  const { lookupLibrary, calls } = fakeLookup({ byIsbn: { a: [record('La Horde du Contrevent', { author: 'Damasio' })], b: [record('La Horde du Contrevent')] } });
  let bnfCalls = 0;
  const findTitle = async () => { bnfCalls++; return null; };
  const seen = [];
  const { results, info } = await searchBook({ isbn: '9782070464241' }, [lib('a'), lib('b')], { onResult: (r) => seen.push(r.libraryId), deps: { lookupLibrary, findTitle } });
  assert.equal(bnfCalls, 0);
  assert.equal(calls.length, 2);
  assert.deepEqual(seen.sort(), ['a', 'b']);
  assert.equal(results.a.status, 'available');
  assert.deepEqual(info, { title: 'La Horde du Contrevent', authors: ['Damasio'] });
});

test('édition absente : titre demandé à la BnF, notices marquées « autre édition »', async () => {
  clearCache();
  const { lookupLibrary, calls } = fakeLookup({ byIsbn: { a: [record('Le Petit Prince')] }, byTitle: { b: [record('Le petit prince', { sameEdition: null })] } });
  const findTitle = async (isbn) => ({ title: 'Le petit prince', authors: ['Antoine de Saint-Exupéry'], isbn });
  const { results, info } = await searchBook({ isbn: '9782070612758' }, [lib('a'), lib('b')], { deps: { lookupLibrary, findTitle } });
  assert.deepEqual(calls.find((c) => c.lib === 'b' && !c.isbns.length), { lib: 'b', isbns: [], title: 'Le petit prince' });
  assert.equal(results.b.status, 'available');
  assert.deepEqual(results.b.searchedBy, ['isbn', 'title']);
  assert.equal(results.b.records[0].sameEdition, false);
  assert.equal(info.title, 'Le petit prince');
});

test('BnF muette : titre repris d’une notice trouvée dans une autre bibliothèque', async () => {
  clearCache();
  const { lookupLibrary, calls } = fakeLookup({ byIsbn: { a: [record('Blacksad', { author: 'Canales' })] }, byTitle: {} });
  const { results } = await searchBook({ isbn: '9782205049435' }, [lib('a'), lib('b')], { deps: { lookupLibrary, findTitle: async () => null } });
  assert.equal(calls.find((c) => c.lib === 'b' && !c.isbns.length).title, 'Blacksad');
  assert.equal(results.b.status, 'absent');
  assert.deepEqual(results.b.searchedBy, ['isbn', 'title']);
});

test('repli désactivé : ni BnF ni recherche par titre', async () => {
  clearCache();
  const { lookupLibrary, calls } = fakeLookup({});
  let bnfCalls = 0;
  await searchBook({ isbn: '9782070612758' }, [lib('a')], { titleFallback: false, deps: { lookupLibrary, findTitle: async () => { bnfCalls++; } } });
  assert.equal(bnfCalls, 0);
  assert.equal(calls.length, 1);
});

test('catalogue en erreur : message lisible, les autres continuent', async () => {
  clearCache();
  const lookupLibrary = async (l) => {
    if (l.id === 'a') throw new TypeError('Network request failed');
    return { libraryId: l.id, status: 'available', records: [record('X')] };
  };
  const { results } = await searchBook({ isbn: '9782070612758' }, [lib('a'), lib('b')], { deps: { lookupLibrary, findTitle: async () => null } });
  assert.deepEqual(results.a, { libraryId: 'a', status: 'error', error: 'Catalogue injoignable (réseau)' });
  assert.equal(results.b.status, 'available');
});

test('résultats gardés en cache, sauf actualisation forcée', async () => {
  clearCache();
  const { lookupLibrary, calls } = fakeLookup({ byIsbn: { a: [record('X')] } });
  const deps = { lookupLibrary, findTitle: async () => null };
  await searchBook({ isbn: '9782070612758' }, [lib('a')], { deps });
  await searchBook({ isbn: '9782070612758' }, [lib('a')], { deps });
  assert.equal(calls.length, 1);
  await searchBook({ isbn: '9782070612758' }, [lib('a')], { deps, force: true });
  assert.equal(calls.length, 2);
});

// Réponse SRU de la BnF (Dublin Core), abrégée.
const BNF = `<?xml version="1.0" encoding="UTF-8"?>
<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
  <srw:version>1.2</srw:version><srw:numberOfRecords>1</srw:numberOfRecords>
  <srw:records><srw:record><srw:recordSchema>dc</srw:recordSchema><srw:recordPacking>xml</srw:recordPacking>
    <srw:recordData><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:identifier>https://catalogue.bnf.fr/ark:/12148/cb42502946s</dc:identifier>
      <dc:title>Le petit prince / Antoine de Saint-Exupéry ; avec des aquarelles de l'auteur</dc:title>
      <dc:creator>Saint-Exupéry, Antoine de (1900-1944). Auteur du texte</dc:creator>
      <dc:creator>Saint-Exupéry, Antoine de (1900-1944). Illustrateur</dc:creator>
      <dc:publisher>Gallimard jeunesse (Paris)</dc:publisher>
      <dc:date>2010</dc:date>
      <dc:type xml:lang="fre">texte imprimé</dc:type>
    </oai_dc:dc></srw:recordData>
  </srw:record></srw:records>
</srw:searchRetrieveResponse>`;

test('BnF : titre sans mention de responsabilité, premier auteur remis dans l’ordre', () => {
  assert.deepEqual(parseBnf(BNF), { title: 'Le petit prince', authors: ['Antoine de Saint-Exupéry'] });
});

test('BnF : aucun résultat', () => {
  assert.equal(parseBnf('<srw:searchRetrieveResponse><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>'), null);
});

test('BnF : formes d’auteur', () => {
  assert.equal(bnfAuthor('Camus, Albert (1913-1960). Auteur du texte'), 'Albert Camus');
  assert.equal(bnfAuthor('Tolkien, J. R. R.. Auteur du texte'), 'J. R. R. Tolkien');
  assert.equal(bnfAuthor('Hergé'), 'Hergé');
});

test('BnF : requête par EAN', () => {
  assert.equal(new URL(bnfUrl('9782070612758')).searchParams.get('query'), 'bib.fuzzyISBN all "9782070612758"');
});
