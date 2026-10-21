// Recherche d'un livre dans un réseau de bibliothèques :
// 1. par ISBN (toutes éditions connues en une requête quand le catalogue le permet) ;
// 2. à défaut, par titre + auteur, en ne gardant que les notices qui correspondent vraiment ;
// 3. puis récupération des exemplaires et de leur disponibilité.

import { getConnector } from './connectors/index.js';
import { titleSimilarity, authorAppears, lastName } from './text.js';
import { humanError } from './net.js';

const MAX_ISBNS = 12;
const MAX_RECORDS = 4;

/** La notice trouvée par titre correspond-elle au livre de la page ? */
export function isSameWork(book, record) {
  const titles = [book.title, book.series && `${book.series} ${book.title}`].filter(Boolean);
  const similarity = Math.max(...titles.map((t) => titleSimilarity(t, record.title)));
  const author = book.authors?.[0];
  if (!author) return similarity >= 0.75;
  if (authorAppears(author, `${record.author} ${record.title}`)) return similarity >= 0.6;
  // Notice sans auteur exploitable (certains catalogues ne le renvoient pas) : titre quasi identique exigé.
  return !record.author && similarity >= 0.85;
}

export function overallStatus(records) {
  if (records.some((r) => r.availableCount > 0)) return 'available';
  if (records.some((r) => r.totalCount > 0)) return 'unavailable';
  if (records.length) return 'unknown';
  return 'absent';
}

const DIGITAL = /num[ée]rique|e-?book|en ligne|t[ée]l[ée]chargeable|ressource [ée]lectronique|podcast|streaming/i;
const itemRank = (item) => (item.available === true ? 0 : item.available === null ? 1 : 2);
// Livre papier de la même édition d'abord, version numérique en dernier.
const editionRank = (record) => (record.digital ? 3 : record.sameEdition === true ? 0 : record.sameEdition === null ? 1 : 2);

export async function lookupLibrary(lib, book, { titleFallback = true, signal } = {}) {
  const connector = getConnector(lib.connector);
  const ctx = { signal };
  const isbns = (book.isbns || []).slice(0, MAX_ISBNS);
  let records = [];
  let matchedBy = null;
  const searchedBy = [];

  if (isbns.length) {
    searchedBy.push('isbn');
    records = await connector.searchIsbn(lib, isbns, ctx);
    if (records.length) matchedBy = 'isbn';
  }
  if (!records.length && titleFallback && book.title) {
    searchedBy.push('title');
    records = (await connector.searchTitle(lib, book, ctx)).filter((r) => isSameWork(book, r));
    if (records.length) matchedBy = 'title';
  }

  for (const r of records) {
    r.match = matchedBy;
    // true / false : on sait si c'est l'édition de la page ; null : impossible à dire (ou pas d'ISBN de référence).
    if (matchedBy === 'isbn') r.sameEdition = r.isbns.length ? r.isbns.includes(isbns[0]) : null;
    else r.sameEdition = isbns.length ? false : null;
    r.digital = DIGITAL.test(r.type || '');
  }
  records = records.sort((a, b) => editionRank(a) - editionRank(b)).slice(0, MAX_RECORDS);

  await Promise.all(records.map(async (r) => {
    try {
      r.items = await connector.holdings(lib, r, ctx);
    } catch (error) {
      if (signal?.aborted) throw error;
      r.items = r.items || [];
      r.holdingsError = humanError(error);
    }
  }));

  // Exemplaires en réserve (« stacks » : fermée au public, sur demande aux bibliothécaires) : ni listés
  // ni comptés comme disponibles, seulement signalés quand la notice n'a pas d'autre exemplaire.
  for (const r of records) {
    r.stacksCount = r.items.filter((i) => i.stacks).length;
    r.items = r.items.filter((i) => !i.stacks);
  }

  // Réseau filtré (ex. ville de Bordeaux dans le catalogue métropolitain) : notice sans exemplaire local = absente.
  if (lib.branchFilter) records = records.filter((r) => r.holdingsError || r.items.length);

  for (const r of records) {
    r.availableCount = r.counts?.available ?? r.items.filter((i) => i.available === true).length;
    r.totalCount = r.counts?.total ?? r.items.length;
    r.items.sort((a, b) => itemRank(a) - itemRank(b) || a.branch.localeCompare(b.branch, 'fr'));
  }
  records.sort((a, b) => editionRank(a) - editionRank(b) || Number(b.availableCount > 0) - Number(a.availableCount > 0) || b.totalCount - a.totalCount);

  const query = matchedBy === 'isbn' || (!book.title && isbns.length) ? isbns[0] : `${book.title || ''} ${lastName(book.authors?.[0])}`.trim();
  return {
    libraryId: lib.id,
    status: overallStatus(records),
    matchedBy,
    searchedBy,
    records,
    searchUrl: connector.searchUrl(lib, query),
    checkedAt: Date.now(),
  };
}
