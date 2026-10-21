// Connecteur Syracuse (Archimed) : Paris, Lille, Strasbourg, Montpellier, Nice, Grenoble, Mérignac…
// API JSON publique du portail : Search.svc/Search puis ILSClient.svc/GetHoldings.

import { request, HttpError } from '../net.js';
import { cleanRecordTitle, lastName } from '../text.js';
import { classifyStatus, isOnSiteOnly, parseFrenchDate } from '../availability.js';
import { toIsbn13 } from '../isbn.js';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' };
// Site « Magasin » (Mérignac) : la réserve, fermée au public. Le document se demande aux bibliothécaires.
const STACKS = /^(magasin|r[ée]serve)$/i;

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
  // Le scénario DEFAULT cherche aussi dans les ressources en ligne du portail (Mérignac : un podcast
  // Radio France pour l'ISBN du Petit Prince) : on ne garde que les notices du catalogue.
  return (d?.Results || []).map((r) => toRecord(lib, r)).filter((r) => r.physical || r.docbase === 'SYRACUSE');
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
      const site = String(h.Site || '').trim();
      const stacks = STACKS.test(site);
      return {
        branch: stacks ? 'Réserve (magasin)' : site || 'Bibliothèque',
        group: h.TopLevelScope || '',
        callNumber: String(h.Cote || '').trim(),
        location: [stacks ? 'À demander aux bibliothécaires' : '', h.Section, h.Localisation].map((x) => String(x || '').trim()).filter(Boolean).join(' · '),
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
