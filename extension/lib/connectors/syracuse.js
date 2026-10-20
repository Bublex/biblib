// Connecteur Syracuse (Archimed) : Paris, Lille, Strasbourg, Montpellier, Nice, Grenoble, Mérignac…
// API JSON publique du portail : Search.svc/Search puis ILSClient.svc/GetHoldings.

import { request, HttpError } from '../net.js';
import { cleanRecordTitle, lastName } from '../text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../availability.js';
import { toIsbn13 } from '../isbn.js';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' };

async function post(lib, path, payload, ctx) {
  const res = await request(lib.base + path, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload), signal: ctx.signal });
  if (!res.ok) throw new HttpError(res.status, lib.base + path);
  const json = await res.json();
  if (json?.success === false) {
    // Exemple (Paris, quand le SIGB est en panne) : « Veuillez nous excuser, la page n'a pas pu s'afficher complètement. »
    const msg = json.errors?.[0]?.msg?.split('\n')[0]?.trim();
    throw new Error(msg ? `Le catalogue indique : « ${msg} »` : 'Le catalogue rencontre une erreur');
  }
  return json?.d;
}

function toRecord(lib, result) {
  const r = result.Resource || {};
  const isbn = /^isbn:/i.test(r.Id || '') ? toIsbn13(r.Id) : null;
  return {
    id: `${r.RscBase}/${r.RscId}`,
    rscId: r.RscId,
    docbase: r.RscBase,
    title: cleanRecordTitle(r.Ttl),
    author: (r.Crtr || '').replace(/\.\s*Auteur$/, ''),
    year: r.Dt || '',
    type: r.Type || '',
    url: result.FriendlyUrl || `${lib.base}/${lib.portal || 'Default'}/doc/${r.RscBase}/${r.RscId}`,
    isbns: isbn ? [isbn] : [],
    physical: Boolean(result.SeekForHoldings),
  };
}

async function search(lib, queryString, ctx, size = 10) {
  const d = await post(lib, '/Portal/Recherche/Search.svc/Search', {
    query: {
      InitialSearch: true,
      Page: 0,
      PageRange: 3,
      QueryString: queryString,
      ResultSize: size,
      ScenarioCode: lib.scenario || 'CATALOGUE',
      SearchContext: 0,
      SearchLabel: '',
    },
    sst: 4,
  }, ctx);
  return (d?.Results || []).map((r) => toRecord(lib, r));
}

export default {
  id: 'syracuse',

  async searchIsbn(lib, isbns, ctx) {
    return search(lib, isbns.join(' OR '), ctx);
  },

  async searchTitle(lib, book, ctx) {
    const records = await search(lib, `${book.title} ${lastName(book.authors?.[0])}`.trim(), ctx, 15);
    return records.filter((r) => r.physical);
  },

  async holdings(lib, record, ctx) {
    if (!record.physical) return [];
    const d = await post(lib, '/Portal/Services/ILSClient.svc/GetHoldings', { Record: { RscId: record.rscId, Docbase: record.docbase } }, ctx);
    return (d?.Holdings || []).map((h) => {
      const when = String(h.WhenBack || '').trim();
      const statut = String(h.Statut || '').trim();
      const status = [statut, when && !/^retour/i.test(when) ? `retour prévu le ${when}` : when].filter(Boolean).join(' – ');
      return {
        branch: String(h.Site || '').trim() || 'Bibliothèque',
        group: h.TopLevelScope || '',
        callNumber: String(h.Cote || '').trim(),
        location: [h.Section, h.Localisation].map((x) => String(x || '').trim()).filter(Boolean).join(' · '),
        status: status || (h.IsAvailable ? 'Disponible' : 'Indisponible'),
        available: typeof h.IsAvailable === 'boolean' ? h.IsAvailable : classifyStatus(statut),
        onSiteOnly: isOnSiteOnly(statut),
        dueDate: parseFrenchDate(when),
        reservable: Boolean(h.IsReservable),
      };
    });
  },

  searchUrl(lib, query) {
    return `${lib.base}/${lib.portal || 'Default'}/search.aspx?SC=${lib.scenario || 'CATALOGUE'}&QUERY=${encodeURIComponent(query)}`;
  },
};
