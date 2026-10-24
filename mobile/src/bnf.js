// Titre et auteur d'un livre à partir de son ISBN, au catalogue général de la BnF (service SRU, Dublin Core).
// Sert au repli par titre quand l'édition scannée n'est pas dans une bibliothèque : le code-barres ne donne
// que l'ISBN, alors que sur une page de livre l'extension lit le titre dans la page.

import { request, readText } from '../../extension/lib/net.js';
import { cleanRecordTitle, decodeEntities } from '../../extension/lib/text.js';

const SRU = 'https://catalogue.bnf.fr/api/SRU';

export function bnfUrl(isbn) {
  const query = `bib.fuzzyISBN all "${isbn}"`;
  return `${SRU}?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=1&query=${encodeURIComponent(query)}`;
}

/** « Saint-Exupéry, Antoine de (1900-1944). Auteur du texte » -> « Antoine de Saint-Exupéry ». */
export function bnfAuthor(creator) {
  const name = decodeEntities(creator)
    .replace(/\s*\(.*$/, '')
    .replace(/\.\s*(auteur|illustrat|tradu|scénari|dessinat|adapta|préfac|édit|direct|coloris|photograph|narrat|contribu)[^.]*$/i, '')
    .trim();
  const [last, first] = name.split(/,\s*/);
  return first ? `${first} ${last}` : last;
}

/** Premier livre de la réponse SRU, ou null. */
export function parseBnf(xml) {
  const record = (String(xml).match(/<(?:\w+:)?recordData>([\s\S]*?)<\/(?:\w+:)?recordData>/) || [])[1];
  if (!record) return null;
  const field = (name) => [...record.matchAll(new RegExp(`<dc:${name}[^>]*>([\\s\\S]*?)</dc:${name}>`, 'g'))].map((m) => m[1].trim());
  const title = cleanRecordTitle(field('title')[0]);
  if (!title) return null;
  return { title, authors: field('creator').slice(0, 1).map(bnfAuthor).filter(Boolean) };
}

export async function bnfLookup(isbn, { signal } = {}) {
  const res = await request(bnfUrl(isbn), { signal, timeout: 8000 });
  if (!res.ok) return null;
  return parseBnf(await readText(res));
}
