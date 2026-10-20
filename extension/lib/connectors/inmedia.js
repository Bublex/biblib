// Connecteur inMedia (Bibliomondo) : Bordeaux et sa métropole, Lyon, Marseille, Nantes…
// Le portail signe chaque appel à /in/rest/api avec un en-tête X-InMedia-Authorization :
//   « Bearer <jeton usager|null> <jeton public du site> <empreinte de la requête> »
// Le jeton public et l'identifiant de site sont publiés dans /in/rest/api/settings.js.

import { request, HttpError } from '../net.js';
import { cleanRecordTitle, lastName } from '../text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../availability.js';
import { toIsbn13 } from '../isbn.js';

const CONFIG_TTL = 5 * 60 * 1000;

// Le jeton public est lié au cookie de session (JSESSIONID) : une seule session par serveur,
// partagée par les recherches parallèles (Bordeaux et Bordeaux Métropole utilisent le même serveur ;
// deux sessions simultanées invalideraient mutuellement leurs jetons).
const configs = new Map(); // base -> { at, promise }

/** Empreinte calculée par le portail inMedia sur le corps (POST) ou la chaîne de requête (GET). */
export function signature(text) {
  const s = String(text).normalize('NFC');
  let n = 305419896;
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i) * (i + 1);
  return n.toString();
}

async function fetchConfig(lib) {
  const res = await request(`${lib.base}/in/rest/api/settings.js`, { credentials: 'include' });
  if (!res.ok) throw new HttpError(res.status, lib.base);
  const js = await res.text();
  const grab = (key) => (js.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`)) || [])[1];
  const config = { micro: grab('microsite') || grab('mainsite') || 'mainSite', token: grab('ckSite') || grab('apiToken') };
  if (!config.token) throw new Error('Configuration du catalogue illisible');
  return config;
}

/** Configuration en cours pour ce serveur ; `stale` : celle qui vient d'être refusée (on en ouvre une nouvelle,
 *  sauf si une autre requête l'a déjà renouvelée entre-temps). */
function getConfig(lib, stale = null) {
  const cached = configs.get(lib.base);
  if (cached && cached !== stale && Date.now() - cached.at < CONFIG_TTL) return cached;
  const entry = { at: Date.now(), promise: fetchConfig(lib) };
  configs.set(lib.base, entry);
  entry.promise.catch(() => { if (configs.get(lib.base) === entry) configs.delete(lib.base); });
  return entry;
}

// Un jeton refusé ne provoque pas d'erreur HTTP : le portail répond 200 avec un objet tronqué
// ({ numHits: 0 } ou { code, error }). Chaque appel précise donc à quoi ressemble une réponse valide.
async function api(lib, path, { query, body, isValid }, ctx) {
  let entry = getConfig(lib);
  for (let attempt = 0; ; attempt++) {
    const config = await entry.promise;
    let url = `${lib.base}/in/rest/api/${path}`;
    let signed = body;
    if (body === undefined) {
      const qs = `?${Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
      url += qs;
      signed = decodeURIComponent(qs);
    }
    const headers = {
      Accept: 'application/json',
      'X-microsite-id': config.micro,
      'X-InMedia-Authorization': `Bearer null ${config.token} ${signature(signed)}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await request(url, { method: body === undefined ? 'GET' : 'POST', headers, body, credentials: 'include', signal: ctx.signal });
    const refused = res.status === 401 || res.status === 403;
    if (!res.ok && !refused) throw new HttpError(res.status, url);
    const json = refused ? null : await res.json().catch(() => null);
    if (json && isValid(json)) return json;
    if (attempt) throw refused ? new HttpError(res.status, url) : new Error('Le catalogue a refusé la requête (session expirée)');
    entry = getConfig(lib, entry);
  }
}

const value = (record, field) => record?.[field]?.[0]?.value;

function toRecord(lib, r) {
  const id = value(r, 'id');
  return {
    id,
    title: cleanRecordTitle(value(r, 'title')),
    author: '',
    year: '',
    type: String(value(r, 'zmatDisplay') || '').trim(),
    url: `${lib.base}/notice?id=${encodeURIComponent(id)}`,
    isbns: (r.ISBN || []).map((x) => toIsbn13(x.value)).filter(Boolean),
    physical: value(r, 'IsPhysicalDocument') === '1',
  };
}

async function search(lib, query, ctx, pageSize = 10) {
  const body = JSON.stringify({
    query: [query],
    queryid: crypto.randomUUID(),
    order: 'score_DESC',
    sf: lib.sf || '*',
    includeFacets: false,
    pageSize,
    pageNo: 1,
    locale: 'fr',
  });
  const json = await api(lib, 'search', { body, isValid: (j) => 'queryid' in j }, ctx);
  return (json.resultSet || []).map((r) => toRecord(lib, r)).filter((r) => r.id && r.physical);
}

function isbnQuery(isbns, prefixed) {
  return isbns.map((i) => (prefixed ? `isbn:${i}` : i)).join(' OR ');
}

export default {
  id: 'inmedia',

  async searchIsbn(lib, isbns, ctx) {
    const syntax = lib.isbnSyntax || 'auto';
    const records = await search(lib, isbnQuery(isbns, syntax === 'prefixed'), ctx);
    if (records.length || syntax !== 'auto') return records;
    return search(lib, isbnQuery(isbns, true), ctx);
  },

  async searchTitle(lib, book, ctx) {
    return search(lib, `${book.title} ${lastName(book.authors?.[0])}`.trim(), ctx, 15);
  },

  async holdings(lib, record, ctx) {
    const json = await api(lib, 'notice', {
      query: { id: record.id, locale: 'fr', aspect: 'Stock', opac: 'true' },
      isValid: (j) => 'id' in j || 'monographicCopies' in j,
    }, ctx);
    const copies = (json.monographicCopies || []).flatMap((group) => (group.children || []).map((c) => c.data || {}));
    const filter = lib.branchFilter;
    return copies
      .filter((d) => !filter || filter.values.includes(String(d[filter.field] || '').trim()))
      .map((d) => {
        const status = String(d.stat_desc || '').trim();
        return {
          branch: String(d.branch_desc || d.branch || 'Bibliothèque').trim(),
          group: String(d.parentBranch_desc || '').replace(/^Commune (de la |de l'|du |des |de |d')/i, '').trim(),
          callNumber: String(d.callnumber || '').trim(),
          location: [d.subloca_desc, d.site_desc].map((x) => String(x || '').trim()).filter((x) => x && x !== '()').join(' · '),
          status: status || 'Statut inconnu',
          available: classifyStatus(status),
          onSiteOnly: isOnSiteOnly(`${status} ${d.category_desc || ''}`),
          dueDate: parseFrenchDate(status),
          reservable: d.copyCanReserve === 'true',
        };
      });
  },

  searchUrl(lib) {
    // Les recherches inMedia n'ont pas d'URL publique stable : on renvoie vers l'accueil du catalogue.
    return lib.home || lib.base;
  },
};
