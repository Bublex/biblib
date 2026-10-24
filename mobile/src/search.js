// Recherche d'un livre dans les bibliothèques choisies, comme le service worker de l'extension :
// résultats au fil de l'eau, cache de 15 minutes, délai maximal par catalogue.
// Différence : un code-barres ne donne que l'ISBN. Quand une bibliothèque n'a pas cette édition, on cherche
// le titre (BnF, sinon notice trouvée dans une autre bibliothèque) pour proposer une autre édition.

import { lookupLibrary } from '../../extension/lib/lookup.js';
import { humanError } from '../../extension/lib/net.js';
import { bnfAuthor, bnfLookup } from './bnf.js';

const CACHE_TTL = 15 * 60 * 1000;
const LOOKUP_TIMEOUT = 45000;

const cache = new Map();

export function clearCache() {
  cache.clear();
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms); }),
  ]).finally(() => clearTimeout(timer));
}

// Les catalogues donnent l'auteur sous la forme « Nom, Prénom » : remis dans l'ordre pour l'affichage.
const titleOf = (record) => record && { title: record.title, authors: record.author ? [bnfAuthor(record.author)] : [] };

/**
 * book : { isbn } ou { title, authors } (saisie manuelle). onResult(result) est appelé pour chaque bibliothèque.
 * Renvoie { results, info } ; info : titre et auteur trouvés en chemin, pour la liste des livres.
 */
export async function searchBook(book, libs, { titleFallback = true, force = false, signal, onResult, deps = {} } = {}) {
  const lookup = deps.lookupLibrary || lookupLibrary;
  const findTitle = deps.findTitle || bnfLookup;
  const isbns = book.isbn ? [book.isbn] : [];
  const byIsbn = new Map(); // libId -> résultat de la recherche par ISBN (promesse)
  let titleSearch = null;

  // Une seule recherche de titre par livre, faite seulement si une bibliothèque n'a pas l'édition scannée.
  const getTitle = () => {
    titleSearch ??= (async () => {
      if (book.title) return { title: book.title, authors: book.authors || [] };
      const fromBnf = await findTitle(book.isbn, { signal }).catch(() => null);
      if (fromBnf) return fromBnf;
      const others = await Promise.all(byIsbn.values());
      return titleOf(others.flatMap((r) => r?.records || []).find((r) => r.title)) || null;
    })();
    return titleSearch;
  };

  async function searchLibrary(lib) {
    const key = [lib.id, book.isbn || '', book.title || '', titleFallback ? 1 : 0].join('|');
    const cached = cache.get(key);
    if (!force && cached && Date.now() - cached.at < CACHE_TTL) {
      byIsbn.set(lib.id, Promise.resolve(cached.value));
      return cached.value;
    }
    try {
      let result;
      if (!isbns.length) {
        result = await withTimeout(lookup(lib, { isbns: [], title: book.title, authors: book.authors || [] }, { titleFallback: true, signal }), LOOKUP_TIMEOUT);
      } else {
        const pending = withTimeout(lookup(lib, { isbns, title: '', authors: [] }, { titleFallback: false, signal }), LOOKUP_TIMEOUT);
        byIsbn.set(lib.id, pending.catch(() => null));
        result = await pending;
        if (result.status === 'absent' && titleFallback) {
          const found = await getTitle();
          if (found?.title) {
            const byTitle = await withTimeout(lookup(lib, { isbns: [], ...found }, { titleFallback: true, signal }), LOOKUP_TIMEOUT);
            // L'ISBN scanné n'y est pas : ce qui est trouvé par titre est forcément une autre édition.
            for (const r of byTitle.records) r.sameEdition = false;
            result = { ...(byTitle.records.length ? byTitle : result), searchedBy: ['isbn', 'title'] };
          }
        }
      }
      cache.set(key, { at: Date.now(), value: result });
      return result;
    } catch (error) {
      if (signal?.aborted) throw error;
      return { libraryId: lib.id, status: 'error', error: humanError(error) };
    }
  }

  const all = await Promise.all(libs.map(async (lib) => {
    const result = await searchLibrary(lib);
    onResult?.(result);
    return result;
  }));

  const sameEdition = all.flatMap((r) => r.records || []).find((r) => r.match === 'isbn' && r.title);
  const info = (titleSearch && (await titleSearch)) || titleOf(sameEdition) || null;
  return { results: Object.fromEntries(all.map((r) => [r.libraryId, r])), info };
}
