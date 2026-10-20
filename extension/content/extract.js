// Détection du livre affiché sur la page : ISBN (et ISBN des autres éditions), titre, auteurs.
// Script « classique » (les scripts de contenu ne peuvent pas être des modules) : expose globalThis.BiblibExtract.
(() => {
  'use strict';

  // --- ISBN ---

  const cleanIsbn = (raw) => String(raw ?? '').toUpperCase().replace(/[^0-9X]/g, '');

  function isValid10(s) {
    if (!/^\d{9}[\dX]$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
    return sum % 11 === 0;
  }

  function isValid13(s) {
    if (!/^97[89]\d{10}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
    return sum % 10 === 0;
  }

  function toIsbn13(raw) {
    const s = cleanIsbn(raw);
    if (isValid13(s)) return s;
    if (!isValid10(s)) return null;
    const base = `978${s.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 ? 3 : 1);
    return base + ((10 - (sum % 10)) % 10);
  }

  /** ISBN valides contenus dans un texte (séparés par des tirets ou non). */
  function isbnsIn(text) {
    const out = [];
    for (const m of String(text ?? '').matchAll(/(?:\d[-‐]?){9,12}[\dXx]/g)) {
      const isbn = toIsbn13(m[0]);
      if (isbn && !out.includes(isbn)) out.push(isbn);
    }
    return out;
  }

  const unique = (list) => [...new Set(list.filter(Boolean))];
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const $ = (doc, sel) => doc.querySelector(sel);
  const $$ = (doc, sel) => [...doc.querySelectorAll(sel)];

  function names(value) {
    return [].concat(value || []).map((a) => (typeof a === 'string' ? a : a?.name)).filter((n) => typeof n === 'string').map((n) => n.trim());
  }

  // --- Sources génériques : JSON-LD, microdonnées, balises meta, URL, libellés « ISBN » ---

  const BOOK_TYPES = /^(Book|Audiobook|ComicIssue|ComicStory|ComicSeries)$/i;

  function walk(node, visit, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, visit, depth + 1);
      return;
    }
    visit(node);
    for (const key of ['@graph', 'mainEntity', 'workExample', 'itemOffered', 'about']) {
      if (node[key]) walk(node[key], visit, depth + 1);
    }
  }

  function fromJsonLd(doc) {
    const nodes = [];
    for (const script of $$(doc, 'script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(script.textContent), (node) => {
          const types = [].concat(node['@type'] || []).map(String);
          const isBook = types.some((t) => BOOK_TYPES.test(t));
          const isProduct = types.some((t) => /^(Product|CreativeWork|IndividualProduct)$/i.test(t));
          if (!isBook && !isProduct) return;
          const isbns = unique([node.isbn, node.gtin13, node.gtin, node.ean, node.productID].flat().map(toIsbn13));
          if (!isBook && !isbns.length) return;
          nodes.push({ isBook, isbns, title: typeof node.name === 'string' ? node.name.trim() : '', authors: names(node.author) });
        });
      } catch {
        // JSON-LD mal formé : ignoré.
      }
    }
    return nodes;
  }

  function fromMicrodata(doc) {
    const isbns = unique($$(doc, '[itemprop="isbn"], [itemprop="gtin13"]').map((el) => toIsbn13(el.getAttribute('content') || el.textContent)));
    const scope = $(doc, '[itemtype*="schema.org/Book"]');
    if (!isbns.length && !scope) return null;
    const root = scope || doc;
    const nameEl = root.querySelector('[itemprop="name"]');
    return {
      isBook: Boolean(scope),
      isbns,
      title: (nameEl?.getAttribute('content') || text(nameEl)).trim(),
      authors: unique([...root.querySelectorAll('[itemprop="author"]')].map((el) => (el.getAttribute('content') || text(el.querySelector('[itemprop="name"]')) || text(el)).trim())),
    };
  }

  function fromMeta(doc) {
    const meta = (key) => $(doc, `meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content') || '';
    const isbns = unique(['book:isbn', 'books:isbn', 'og:isbn', 'isbn'].map((k) => toIsbn13(meta(k))));
    const isBook = /^(book|books\.book)$/i.test(meta('og:type'));
    return { isBook, isbns, title: isBook ? meta('og:title') : '', authors: [] };
  }

  /** ISBN situés à côté d'un libellé « ISBN » / « EAN » dans le texte visible. */
  function fromLabels(doc, max = 4) {
    const found = [];
    const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (/\b(ISBN|EAN|GTIN)/i.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    let node;
    while ((node = walker.nextNode()) && found.length < max) {
      let el = node.parentElement;
      for (let hop = 0; el && hop < 3; hop++, el = el.parentElement) {
        const t = el.textContent || '';
        if (t.length > 200) break;
        const isbns = isbnsIn(t);
        if (isbns.length) {
          found.push(...isbns);
          break;
        }
      }
    }
    return unique(found).slice(0, max);
  }

  function fromUrl(loc) {
    return unique((loc.pathname.match(/97[89]\d{10}/g) || []).map(toIsbn13));
  }

  // --- Règles propres à certains sites ---

  function amazon(doc, loc) {
    const title = text($(doc, '#productTitle'));
    if (!title) return null;
    const isbns = [];
    for (const el of $$(doc, '[id^="rpi-attribute-book_details-isbn"], #detailBullets_feature_div li, #detailBulletsWrapper_feature_div li, #productDetailsTable li, #productDetails_detailBullets_sections1 tr')) {
      const t = text(el);
      if (/ISBN|EAN/i.test(t)) isbns.push(...isbnsIn(t));
    }
    const asin = $(doc, '#ASIN, input[name="ASIN"]')?.value || (loc.pathname.match(/\/(?:dp|product|d)\/([0-9X]{10})(?:[/?]|$)/i) || [])[1];
    if (asin && isValid10(asin.toUpperCase())) isbns.push(toIsbn13(asin));
    const crumbs = text($(doc, '#wayfinding-breadcrumbs_feature_div'));
    const format = `${text($(doc, '#productSubtitle'))} ${text($(doc, '#bylineInfo'))}`;
    const isBook = isbns.length > 0
      || /\b(Livres|Books|Bücher|Libri|Libros|Kindle|Bandes dessinées|Mangas|Comics)\b/i.test(crumbs)
      || /(Broché|Poche|Relié|Format Kindle|Paperback|Hardcover|Livre audio|Album)/i.test(format);
    if (!isBook) return null;
    const authors = $$(doc, '#bylineInfo .author')
      .filter((el) => !/\((Traduction|Traducteur|Illustrations?|Illustrateur|Translator|Illustrator|Préface|Narrateur|Lu par|Editor|Éditeur)/i.test(text(el)))
      .map((el) => text(el.querySelector('a') || el));
    return { isBook: true, isbns: unique(isbns), title, authors: unique(authors) };
  }

  function babelioEditions(doc) {
    return unique($$(doc, '.ed-codes').flatMap((el) => isbnsIn(text(el))));
  }

  function bedetheque(doc, book) {
    // Microdonnées : name = « Série - Titre de l'album », h1 = série.
    const series = text($(doc, 'h1'));
    let title = book.title;
    if (series && title.startsWith(series)) title = title.slice(series.length).replace(/^\s*[-–:]\s*/, '');
    return { ...book, title: title || book.title, series };
  }

  // --- Assemblage ---

  function cleanTitle(t) {
    return String(t || '')
      .replace(/\s+[-–|]\s+(Babelio|Decitre|Fnac|Amazon|Goodreads|Cultura|Gibert|Mollat|Leslibraires\.fr).*$/i, '')
      .replace(/\s*\((French Edition|Edition française|Poche|Broché)\)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanAuthor(a) {
    return String(a || '').replace(/\((Auteur|Author|Autor|Autore)\)/gi, '').replace(/\s+/g, ' ').trim();
  }

  function generic(doc, loc) {
    const ld = fromJsonLd(doc);
    // Plusieurs livres avec des ISBN différents : page de liste (résultats, rayon), pas une fiche.
    const distinct = unique(ld.map((n) => n.isbns[0]));
    if (distinct.length >= 3) return null;
    const primary = ld.find((n) => n.isBook && n.isbns.length) || ld.find((n) => n.isbns.length) || ld.find((n) => n.isBook);
    const micro = fromMicrodata(doc);
    const meta = fromMeta(doc);
    const isBook = Boolean(primary?.isBook || micro?.isBook || meta.isBook);
    let isbns = unique([...(primary?.isbns || []), ...(micro?.isbns || []), ...meta.isbns]);
    if (!isbns.length) isbns = fromUrl(loc);
    if (!isbns.length && isBook) isbns = fromLabels(doc, 2);
    if (!isbns.length && !isBook) return null;
    return {
      isBook,
      isbns,
      title: primary?.title || micro?.title || meta.title || text($(doc, 'h1')),
      authors: unique([...(primary?.authors || []), ...(micro?.authors || [])]),
    };
  }

  function extractBook(doc = document, loc = location) {
    const host = loc.hostname;
    let book = /(^|\.)amazon\./.test(host) ? amazon(doc, loc) : generic(doc, loc);
    if (!book) return null;
    if (/babelio\.com$/.test(host) && !/^\/livres\//.test(loc.pathname)) return null;
    if (/bedetheque\.com$/.test(host)) book = bedetheque(doc, book);
    const isbns = unique(book.isbns);
    const editions = /babelio\.com$/.test(host) ? babelioEditions(doc).filter((i) => !isbns.includes(i)) : [];
    const title = cleanTitle(book.title);
    if (!isbns.length && !title) return null;
    return {
      isbns,
      editions: editions.slice(0, 10),
      title,
      authors: unique(book.authors.map(cleanAuthor)).slice(0, 4),
      series: book.series || '',
      site: host,
      url: loc.href,
    };
  }

  globalThis.BiblibExtract = { extractBook, isbnsIn, toIsbn13 };
})();
