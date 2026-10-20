// Connecteur Encore (Innovative) : Bibliothèques de Rennes / Les Champs Libres.
// Pages de résultats HTML : chaque notice contient son tableau d'exemplaires.

import { request, readText, HttpError } from '../net.js';
import { stripTags, cleanRecordTitle, lastName } from '../text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../availability.js';
import { toIsbn13 } from '../isbn.js';

function searchPath(query) {
  return `/iii/encore/search/C__S${encodeURIComponent(query)}__Orightresult__U?lang=frf`;
}

async function getPage(lib, path, ctx) {
  const res = await request(lib.base + path, { signal: ctx.signal });
  if (!res.ok) throw new HttpError(res.status, lib.base + path);
  return readText(res);
}

const pick = (html, re) => stripTags((html.match(re) || [])[1]);

export function parseEncore(lib, html) {
  const records = [];
  for (const block of html.split(/<div id="resultRecord-/).slice(1)) {
    const bib = (block.match(/^(b\d+)/) || [])[1];
    if (!bib) continue;
    const table = (block.match(/<table class="itemTable"[\s\S]*?<\/table>/) || [])[0] || '';
    const items = [];
    for (const row of table.split(/<tr[\s>]/).slice(1)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
      if (cells.length < 3) continue;
      const [branch, callNumber, status, condition = ''] = cells;
      items.push({
        branch: branch || 'Bibliothèque',
        group: '',
        callNumber,
        location: '',
        status: status || 'Statut inconnu',
        available: classifyStatus(status),
        onSiteOnly: isOnSiteOnly(`${status} ${condition}`),
        dueDate: parseFrenchDate(status),
        reservable: true,
      });
    }
    const isbn = toIsbn13((block.match(/rft\.isbn=([0-9Xx-]+)/) || [])[1]);
    records.push({
      id: bib,
      title: cleanRecordTitle(pick(block, /id="recordDisplayLink2Component"[^>]*>([\s\S]*?)<\/a>/)),
      author: pick(block, /id="authorDisplayLinkComponent"[^>]*>([\s\S]*?)<\/a>/),
      year: pick(block, /class="itemMediaYear"[^>]*>([\s\S]*?)<\/span>/),
      type: pick(block, /class="itemMediaDescription"[^>]*>([\s\S]*?)<\/span>/),
      url: `${lib.base}/iii/encore/record/C__R${bib}?lang=frf`,
      isbns: isbn ? [isbn] : [],
      physical: true,
      items,
    });
  }
  return records;
}

export default {
  id: 'encore',

  async searchIsbn(lib, isbns, ctx) {
    return parseEncore(lib, await getPage(lib, searchPath(isbns.join(' OR ')), ctx));
  },

  async searchTitle(lib, book, ctx) {
    return parseEncore(lib, await getPage(lib, searchPath(`${book.title} ${lastName(book.authors?.[0])}`.trim()), ctx));
  },

  async holdings(lib, record) {
    return record.items || [];
  },

  searchUrl(lib, query) {
    return lib.base + searchPath(query);
  },
};
