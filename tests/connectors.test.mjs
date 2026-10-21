// Connecteurs JSON (Syracuse, inMedia) et orchestration de la recherche, avec un fetch simulé.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { lookupLibrary } from '../extension/lib/lookup.js';
import { getLibrary } from '../extension/lib/libraries.js';
import { signature } from '../extension/lib/connectors/inmedia.js';

const realFetch = globalThis.fetch;
let calls = [];

function mockFetch(routes) {
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    for (const [pattern, handler] of routes) {
      if (String(url).includes(pattern)) {
        const out = await handler(String(url), options);
        const body = typeof out === 'string' ? out : JSON.stringify(out);
        return new Response(body, { status: 200, headers: { 'content-type': typeof out === 'string' ? 'text/javascript' : 'application/json' } });
      }
    }
    return new Response('not found', { status: 404 });
  };
}

beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

const BOOK = { isbns: ['9782070612758', '9782070408504'], title: 'Le Petit Prince', authors: ['Antoine de Saint-Exupéry'] };

test('Syracuse : recherche par ISBN (OR), exemplaires et disponibilité', async () => {
  mockFetch([
    ['Search.svc/Search', (_url, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.query.QueryString, '9782070612758 OR 9782070408504');
      assert.equal(body.query.ScenarioCode, 'CATALOGUE');
      return { success: true, d: { Results: [{
        Resource: { RscId: '558409', RscBase: 'SYRACUSE', Ttl: 'Le Petit Prince', Crtr: 'Antoine de Saint-Exupéry (1900-1944)', Id: 'isbn:978-2070-61-2758', Type: 'Livre' },
        FriendlyUrl: 'https://bibliotheques.paris.fr/Default/doc/SYRACUSE/558409/le-petit-prince',
        SeekForHoldings: true,
      }] } };
    }],
    ['GetHoldings', () => ({ success: true, d: { Holdings: [
      { Site: 'Mohammed Arkoun', Statut: 'En prêt', WhenBack: '12/11/2026', IsAvailable: false, IsReservable: true, Cote: 'R SAI' },
      { Site: 'Buffon', Statut: 'Disponible', WhenBack: '', IsAvailable: true, IsReservable: true, Cote: 'R SAI', Section: 'Jeunesse' },
    ] } })],
  ]);
  const result = await lookupLibrary(getLibrary('paris'), BOOK);
  assert.equal(result.status, 'available');
  assert.equal(result.matchedBy, 'isbn');
  const [record] = result.records;
  assert.equal(record.sameEdition, true);
  assert.equal(record.url, 'https://bibliotheques.paris.fr/Default/doc/SYRACUSE/558409/le-petit-prince');
  assert.equal(record.availableCount, 1);
  assert.equal(record.totalCount, 2);
  assert.equal(record.items[0].branch, 'Buffon');
  assert.equal(record.items[1].dueDate, '2026-11-12');
  assert.equal(record.items[1].status, 'En prêt – retour prévu le 12/11/2026');
  // Pas de cookies envoyés aux catalogues Syracuse, pas de référent.
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
});

test('Syracuse : portail servi sous un sous-dossier (Grand Poitiers)', async () => {
  mockFetch([
    ['Search.svc/Search', (_url, opts) => {
      assert.equal(JSON.parse(opts.body).query.ScenarioCode, 'CATALOGUE');
      return { success: true, d: { Results: [{ Resource: { RscId: '7', RscBase: 'SYRACUSE', Ttl: 'Le Petit Prince' }, SeekForHoldings: true }] } };
    }],
    ['GetHoldings', () => ({ success: true, d: { Holdings: [{ Site: 'François-Mitterrand', Statut: 'Disponible', IsAvailable: true }] } })],
  ]);
  const result = await lookupLibrary(getLibrary('grand-poitiers'), BOOK);
  assert.equal(calls[0].url, 'https://www.mediatheques-grandpoitiers.fr/EXPLOITATION/Portal/Recherche/Search.svc/Search');
  assert.equal(result.records[0].url, 'https://www.mediatheques-grandpoitiers.fr/EXPLOITATION/Default/doc/SYRACUSE/7');
  assert.equal(result.searchUrl, 'https://www.mediatheques-grandpoitiers.fr/EXPLOITATION/Default/search.aspx?SC=CATALOGUE&QUERY=9782070612758');
});

test('Syracuse : scénario DEFAULT, ressources en ligne écartées (Mérignac)', async () => {
  // Réponses observées sur le portail de Mérignac (octobre 2026).
  const podcast = { Resource: { RscId: '2023C45516S0002', RscBase: 'RADIOFRANCE', Ttl: '“Le Petit Prince” a 80 ans', Type: 'Podcast' }, SeekForHoldings: false };
  let results = [
    {
      Resource: { RscId: '489756', RscBase: 'SYRACUSE', Ttl: 'Le petit prince / Antoine de Saint-Exupéry', Id: 'isbn:978-2-07-061275-8', Type: 'Livre' },
      FriendlyUrl: 'https://www.mediatheque.merignac.com/Default/doc/SYRACUSE/489756/le-petit-prince-antoine-de-saint-exupery',
      SeekForHoldings: true,
    },
    podcast,
  ];
  let holdings = [
    { Site: 'Médiathèque du Burck', Statut: 'En rayon', IsAvailable: true, Cote: 'R SAI', Section: 'Jeunes', Localisation: 'Romans' },
    { Site: 'Médiathèque de Beutre', Statut: 'En prêt', WhenBack: '04/11/2026', IsAvailable: false, Cote: 'R SAI' },
    { Site: 'Magasin', Statut: 'En rayon', IsAvailable: true, Cote: 'R SAI', Section: 'Jeunes' },
  ];
  mockFetch([
    ['Search.svc/Search', (_url, opts) => {
      assert.equal(JSON.parse(opts.body).query.ScenarioCode, 'DEFAULT');
      return { success: true, d: { Results: results } };
    }],
    ['GetHoldings', () => ({ success: true, d: { Holdings: holdings } })],
  ]);
  const merignac = getLibrary('merignac');
  const found = await lookupLibrary(merignac, BOOK);
  assert.equal(calls[0].url, 'https://www.mediatheque.merignac.com/Portal/Recherche/Search.svc/Search');
  assert.deepEqual(found.records.map((r) => r.id), ['SYRACUSE/489756']);
  assert.equal(found.status, 'available');
  // « Magasin » n'est pas une médiathèque : c'est la réserve, fermée au public. Ni listée ni « disponible ».
  const [record] = found.records;
  assert.deepEqual(record.items.map((i) => i.branch), ['Médiathèque du Burck', 'Médiathèque de Beutre']);
  assert.equal(record.availableCount, 1);
  assert.equal(record.stacksCount, 1);
  assert.equal(record.items[0].location, 'Jeunes · Romans');

  assert.equal(record.onRequest, false);

  // Exemplaire en réserve seulement (Oliver Twist, tome 1) : le catalogue l'affiche disponible, sur demande.
  holdings = [{ Site: 'Magasin', Statut: 'En rayon', IsAvailable: true, Cote: 'BD DAU' }];
  const stacksOnly = await lookupLibrary(merignac, BOOK);
  assert.equal(stacksOnly.status, 'available');
  assert.deepEqual(stacksOnly.records[0].items, []);
  assert.equal(stacksOnly.records[0].onRequest, true);
  assert.equal(stacksOnly.records[0].availableCount, 1);

  // Exemplaires en rayon tous empruntés : celui de la réserve reste disponible sur demande.
  holdings = [
    { Site: 'Médiathèque du Burck', Statut: 'En prêt', WhenBack: '04/11/2026', IsAvailable: false, Cote: 'BD DAU' },
    { Site: 'Magasin', Statut: 'En rayon', IsAvailable: true, Cote: 'BD DAU' },
  ];
  const lentOut = await lookupLibrary(merignac, BOOK);
  assert.equal(lentOut.status, 'available');
  assert.deepEqual(lentOut.records[0].items.map((i) => i.branch), ['Médiathèque du Burck']);
  assert.equal(lentOut.records[0].onRequest, true);

  // Exemplaire de la réserve lui-même indisponible : au catalogue, disponibilité à vérifier.
  holdings = [{ Site: 'Magasin', Statut: 'En traitement', IsAvailable: false, Cote: 'BD DAU' }];
  const stacksBusy = await lookupLibrary(merignac, BOOK);
  assert.equal(stacksBusy.status, 'unknown');
  assert.equal(stacksBusy.records[0].stacksCount, 1);
  assert.equal(stacksBusy.records[0].onRequest, false);

  // Seul le podcast répond : le livre n'est pas au catalogue (et non « disponibilité à vérifier »).
  results = [podcast];
  const absent = await lookupLibrary(merignac, { ...BOOK, title: '' });
  assert.equal(absent.status, 'absent');
});

test('Syracuse : SIGB en panne -> notice affichée, disponibilité « à vérifier »', async () => {
  mockFetch([
    ['Search.svc/Search', () => ({ success: true, d: { Results: [{ Resource: { RscId: '1', RscBase: 'SYRACUSE', Ttl: 'Le Petit Prince' }, FriendlyUrl: 'https://x/doc', SeekForHoldings: true }] } })],
    ['GetHoldings', () => ({ success: false, errors: [{ msg: 'Veuillez nous excuser, la page n’a pas pu s’afficher complètement. \nVous pouvez actualiser' }] })],
  ]);
  const result = await lookupLibrary(getLibrary('paris'), BOOK);
  assert.equal(result.status, 'unknown');
  assert.match(result.records[0].holdingsError, /pas pu s’afficher complètement/);
});

test('Syracuse : ISBN absent -> recherche par titre filtrée sur l’auteur', async () => {
  mockFetch([
    ['Search.svc/Search', (_url, opts) => {
      const q = JSON.parse(opts.body).query.QueryString;
      if (q.includes(' OR ')) return { success: true, d: { Results: [] } };
      assert.equal(q, 'Le Petit Prince Saint-Exupéry');
      return { success: true, d: { Results: [
        { Resource: { RscId: '1', RscBase: 'SYRACUSE', Ttl: 'Le petit prince / Antoine de Saint-Exupéry', Crtr: 'Saint-Exupéry, Antoine de' }, FriendlyUrl: 'https://x/1', SeekForHoldings: true },
        { Resource: { RscId: '2', RscBase: 'SYRACUSE', Ttl: 'Le petit prince de Belleville', Crtr: 'Beyala, Calixthe' }, FriendlyUrl: 'https://x/2', SeekForHoldings: true },
      ] } };
    }],
    ['GetHoldings', () => ({ success: true, d: { Holdings: [{ Site: 'Italie', Statut: 'Disponible', IsAvailable: true }] } })],
  ]);
  const result = await lookupLibrary(getLibrary('paris'), BOOK);
  assert.equal(result.matchedBy, 'title');
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, 'Le petit prince');
  assert.equal(result.records[0].match, 'title');
});

test('inMedia : requêtes signées, filtre « commune de Bordeaux »', async () => {
  const settingsJs = 'var mobileSettings = {"microsite":"30ed75a2","mainsite":"63a3178f","ckSite":"650528e7"};';
  mockFetch([
    ['/in/rest/api/settings.js', () => settingsJs],
    ['/in/rest/api/search', (_url, opts) => {
      const [, , token, sig] = opts.headers['X-InMedia-Authorization'].split(' ');
      assert.equal(token, '650528e7');
      assert.equal(sig, signature(opts.body));
      assert.equal(opts.headers['X-microsite-id'], '30ed75a2');
      const body = JSON.parse(opts.body);
      assert.deepEqual(body.query, ['9782070612758 OR 9782070408504']);
      return { queryid: body.queryid, numHits: 2, resultSet: [
        { id: [{ value: 'p::usmarcdef_0001012316' }], title: [{ value: 'Le Petit prince' }], ISBN: [{ value: '2070612759' }], IsPhysicalDocument: [{ value: '1' }] },
        { id: [{ value: 'p::usmarcdef_0000000001' }], title: [{ value: 'Le Petit prince' }], ISBN: [{ value: '2070408507' }], IsPhysicalDocument: [{ value: '1' }] },
      ] };
    }],
    ['/in/rest/api/notice', (url, opts) => {
      const qs = url.slice(url.indexOf('?'));
      assert.equal(opts.headers['X-InMedia-Authorization'].split(' ')[3], signature(decodeURIComponent(qs)));
      const id = new URL(url).searchParams.get('id');
      const copies = id.endsWith('1012316')
        ? [
          { branch_desc: 'Mériadeck', parentBranch_desc: 'Commune de Bordeaux', stat_desc: 'Prêté (Retour prévu le : 20/10/2026)', callnumber: 'CLA SAI', copyCanReserve: 'true' },
          { branch_desc: 'Bibliothèque de Bègles', parentBranch_desc: 'Commune de Bègles', stat_desc: 'Disponible', callnumber: 'J SAIN', copyCanReserve: 'true' },
        ]
        : [{ branch_desc: 'Médiathèque La Source', parentBranch_desc: 'Commune du Bouscat ', stat_desc: 'Disponible' }];
      return { canReserve: true, monographicCopies: [{ children: copies.map((data) => ({ data })) }] };
    }],
  ]);

  const bordeaux = await lookupLibrary(getLibrary('bordeaux'), BOOK);
  // Seul l'exemplaire de Bordeaux (prêté) est gardé ; la notice sans exemplaire bordelais disparaît.
  assert.equal(bordeaux.status, 'unavailable');
  assert.equal(bordeaux.records.length, 1);
  assert.equal(bordeaux.records[0].url, 'https://bibliotheque.bordeaux.fr/notice?id=p%3A%3Ausmarcdef_0001012316');
  assert.deepEqual(bordeaux.records[0].items.map((i) => i.branch), ['Mériadeck']);
  assert.equal(bordeaux.records[0].sameEdition, true);

  const metropole = await lookupLibrary(getLibrary('bordeaux-metropole'), BOOK);
  assert.equal(metropole.status, 'available');
  assert.equal(metropole.records.length, 2);
  assert.equal(metropole.records[0].items[0].group, 'Bègles');
  assert.equal(metropole.records[1].sameEdition, false);
  assert.ok(calls.every((c) => c.options.credentials === 'include'));
  // Les deux réseaux partagent le serveur : une seule session (un seul settings.js).
  assert.equal(calls.filter((c) => c.url.includes('settings.js')).length, 1);
});

test('inMedia : jeton refusé -> nouvelle session puis nouvel essai, jamais un faux « absent »', async () => {
  let session = 0;
  let searches = 0;
  mockFetch([
    ['/in/rest/api/settings.js', () => `var mobileSettings = {"mainsite":"mainSite","apiToken":"jeton-${++session}"};`],
    ['/in/rest/api/search', (_url, opts) => {
      searches++;
      const token = opts.headers['X-InMedia-Authorization'].split(' ')[2];
      // Premier jeton périmé : réponse tronquée, sans erreur HTTP (comme le vrai portail).
      if (token === 'jeton-1') return { maxScore: 0, numHits: 0 };
      return { queryid: 'q', numHits: 0, resultSet: [] };
    }],
  ]);
  const result = await lookupLibrary(getLibrary('nantes'), { isbns: ['9782070612758'], title: '', authors: [] });
  assert.equal(result.status, 'absent');
  assert.equal(session, 2);
  assert.equal(searches, 2);

  mockFetch([
    ['/in/rest/api/settings.js', () => 'var mobileSettings = {"mainsite":"mainSite","apiToken":"toujours-refuse"};'],
    ['/in/rest/api/search', () => ({ code: 401, error: 'invalid token' })],
  ]);
  await assert.rejects(lookupLibrary(getLibrary('marseille'), { isbns: ['9782070612758'], title: '', authors: [] }), /refusé/);
});
