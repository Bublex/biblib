// Connecteur « Web2 » (tramp2.exe) : catalogue Rosalis des bibliothèques de Toulouse.
// Pages HTML (ISO-8859-1). Le site pose d'abord un cookie anti-robot puis redirige en JavaScript.
// Pas d'opérateur OR : on interroge les ISBN un par un.

import { request, readText, HttpError } from '../net.js';
import { stripTags, cleanRecordTitle, lastName } from '../text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../availability.js';
import { toIsbn13 } from '../isbn.js';

const MAX_ISBN_QUERIES = 3;

function searchPath(lib, query) {
  return `/web2/tramp2.exe/do_keyword_search/log_in?setting_key=${lib.settingKey}&servers=1home&index=default&query=${encodeURIComponent(query)}`;
}

async function getPage(lib, path, ctx, depth = 0) {
  const res = await request(lib.base + path, { credentials: 'include', signal: ctx.signal });
  if (!res.ok) throw new HttpError(res.status, lib.base + path);
  const html = await readText(res, lib.charset || 'windows-1252');
  // Page anti-robot : <script>window.location.href='/redirect_XXXX/web2/…';</script>
  const jsRedirect = html.length < 2000 && html.match(/window\.location\.href\s*=\s*'([^']+)'/);
  if (jsRedirect) {
    // Défi toujours présent après plusieurs essais : surtout ne pas conclure que le livre est absent.
    if (depth >= 3) throw new Error('Le catalogue a bloqué la requête (protection anti-robot)');
    return getPage(lib, jsRedirect[1].replace(/^https?:\/\/[^/]+/, ''), ctx, depth + 1);
  }
  return html;
}

/** Notice détaillée (un seul résultat) : titre, auteur, lien permanent et tableau des exemplaires. */
function parseDetail(lib, html, query) {
  const titleHtml = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const authorLine = stripTags((html.match(/<div id="auteur">([\s\S]*?)<\/div>/i) || [])[1]).replace(/^de\s+/i, '');
  const [author, year] = authorLine.split(/\s+-\s+(?=\d{4}\s*$)/);
  const permalink = (html.match(/id="BW_link"[\s\S]*?value="([^"]+)"/i) || [])[1];
  const table = (html.match(/<table[^>]*id="exemplaire_table"[\s\S]*?<\/table>/i) || [])[0] || '';
  const items = [];
  for (const row of table.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*class="holdingslistbab"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 4) continue;
    const [branch, callNumber, material, location, extra = ''] = cells;
    const dateText = (extra.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || [])[0];
    const dueDate = parseFrenchDate(dateText);
    // La colonne « Localisation » contient soit un rayon (exemplaire présent), soit un état (« Prêté », « En transit »…).
    const unavailable = classifyStatus(location) === false || Boolean(dueDate);
    items.push({
      branch: branch || 'Bibliothèque',
      group: '',
      callNumber,
      location: unavailable ? '' : location,
      status: unavailable ? [location, dateText && `retour prévu le ${dateText}`].filter(Boolean).join(' – ') : 'Disponible',
      available: !unavailable,
      onSiteOnly: isOnSiteOnly(`${material} ${location}`),
      dueDate,
      reservable: true,
    });
  }
  return [{
    id: permalink || query,
    title: cleanRecordTitle(stripTags(titleHtml)),
    author: (author || '').trim(),
    year: (year || '').trim(),
    type: '',
    url: permalink || lib.base + searchPath(lib, query),
    isbns: [],
    physical: true,
    items,
    detailed: true,
  }];
}

/** Liste de résultats : titre, compte d'exemplaires disponibles, bibliothèques, ISBN caché. */
function parseHitlist(lib, html) {
  const records = [];
  const entry = /<a href="\/web2\/tramp2\.exe\/see_record\/[^"]*">\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/a>[\s\S]*?id="exemplaire_titre">([\s\S]*?)<\/div>[\s\S]*?id="exemplaire_bib">([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = entry.exec(html))) {
    const before = html.slice(Math.max(0, m.index - 1500), m.index);
    const hidden = [...before.matchAll(/<span style="display:none;">\s*([0-9Xx-]{10,17})\s*<\/span>/g)].pop();
    const isbn = hidden ? toIsbn13(hidden[1]) : null;
    const [author, year] = stripTags(m[2]).split(/\s+-\s+(?=\d{4}\s*$)/);
    const counts = stripTags(m[3]).match(/(\d+)\s+exemplaires?[^\d]*?(\d+)/i);
    const libsText = (m[4].match(/var t="([^"]*)"/) || m[4].match(/<!--([\s\S]*?)-->/) || [])[1] || '';
    const branches = libsText.split(/\s+and\s+|\s+et\s+|,\s*/).map((s) => s.trim()).filter(Boolean);
    records.push({
      id: isbn || stripTags(m[1]),
      title: cleanRecordTitle(stripTags(m[1])),
      author: (author || '').trim(),
      year: (year || '').trim(),
      type: '',
      url: lib.base + searchPath(lib, isbn || stripTags(m[1])),
      isbns: isbn ? [isbn] : [],
      physical: true,
      items: branches.map((branch) => ({ branch, group: '', callNumber: '', location: '', status: 'Disponible', available: true, onSiteOnly: false, dueDate: null, reservable: true })),
      counts: counts ? { available: Number(counts[1]), total: Number(counts[2]) } : undefined,
      detailed: false,
    });
  }
  return records;
}

export function parseWeb2(lib, html, query) {
  if (/id="exemplaire_table"/i.test(html)) return parseDetail(lib, html, query);
  if (/id="exemplaire_titre"/i.test(html)) return parseHitlist(lib, html);
  return [];
}

export default {
  id: 'web2',

  async searchIsbn(lib, isbns, ctx) {
    for (const isbn of isbns.slice(0, MAX_ISBN_QUERIES)) {
      const records = parseWeb2(lib, await getPage(lib, searchPath(lib, isbn), ctx), isbn);
      if (records.length) return records;
    }
    return [];
  },

  async searchTitle(lib, book, ctx) {
    const query = `${book.title} ${lastName(book.authors?.[0])}`.trim();
    return parseWeb2(lib, await getPage(lib, searchPath(lib, query), ctx), query);
  },

  async holdings(lib, record, ctx) {
    if (record.detailed || !record.isbns.length) return record.items || [];
    // Depuis une liste de résultats, la recherche par ISBN ouvre directement la notice détaillée.
    const [detail] = parseWeb2(lib, await getPage(lib, searchPath(lib, record.isbns[0]), ctx), record.isbns[0]);
    if (!detail) return record.items || [];
    record.url = detail.url;
    delete record.counts;
    return detail.items;
  },

  searchUrl(lib, query) {
    return lib.base + searchPath(lib, query);
  },
};
