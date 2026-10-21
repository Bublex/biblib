// Interface de Biblib : pastille flottante + panneau de résultats (Shadow DOM fermé),
// et rendu de la liste des bibliothèques réutilisé par la fenêtre de l'extension (popup).
// Tout le contenu venant des catalogues est inséré en texte (jamais en HTML).
(() => {
  'use strict';

  // --- Petits utilitaires DOM ---

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  const ICONS = {
    book: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
    refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
    minus: ['M6 12h12'],
    star: ['M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    lock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  };

  function icon(name, size = 16) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const d of ICONS[name]) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  const safeUrl = (url) => (/^https?:\/\//i.test(String(url || '')) ? url : null);
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function shortDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
  }

  // --- Lecture de l'état ---

  const isFavorite = (settings, libId, branch) => (settings?.favorites?.[libId] || []).includes(branch);

  function earliestReturn(records) {
    const dates = records.flatMap((r) => (r.items || []).filter((i) => i.available === false && i.dueDate).map((i) => i.dueDate));
    const today = new Date().toISOString().slice(0, 10);
    return dates.filter((d) => d >= today).sort()[0] || null;
  }

  /** Résumé affiché dans la pastille. */
  function summarize(state, settings) {
    const libs = state.libraries || [];
    const results = libs.map((l) => state.results[l.id]).filter(Boolean);
    const pending = libs.length - results.length;
    const byId = Object.fromEntries(libs.map((l) => [l.id, l]));

    if (state.noLibraries) return { tone: 'setup', title: 'Choisir mes bibliothèques', detail: 'Pour savoir si ce livre y est' };

    const available = [];
    let digitalLib = null;
    for (const r of results) {
      for (const rec of r.records || []) {
        if (rec.digital) {
          if (rec.availableCount > 0) digitalLib = digitalLib || byId[r.libraryId];
          continue;
        }
        for (const item of rec.items || []) if (item.available === true) available.push({ lib: byId[r.libraryId], item });
      }
    }
    if (available.length) {
      // Réseau où le livre réservé est acheminé vers la bibliothèque choisie : on nomme le réseau, pas une annexe peut-être lointaine.
      const place = (a) => (a.lib.pickupAnywhere ? `${a.lib.short}, retrait au choix` : a.item.branch);
      const fav = available.find((a) => isFavorite(settings, a.lib.id, a.item.branch));
      // Votre bibliothèque d'abord, puis une bibliothèque où l'emprunter directement, puis un réseau où le réserver.
      const first = fav || available.find((a) => !a.lib.pickupAnywhere) || available[0];
      const others = new Set(available.map(place)).size - 1;
      return { tone: 'ok', busy: pending > 0, title: fav ? 'Disponible dans votre bibliothèque' : 'Disponible', detail: `${fav ? fav.item.branch : place(first)}${others > 0 ? ` et ${plural(others, 'autre', 'autres')}` : ''}` };
    }
    // Comptes sans détail par exemplaire (liste de résultats de Toulouse).
    const availLib = results.find((r) => (r.records || []).some((rec) => !rec.digital && rec.availableCount > 0));
    if (availLib) return { tone: 'ok', busy: pending > 0, title: 'Disponible', detail: byId[availLib.libraryId].name };
    if (digitalLib) return { tone: 'ok', busy: pending > 0, title: 'Disponible en version numérique', detail: digitalLib.name };

    const borrowed = results.filter((r) => r.status === 'unavailable');
    if (borrowed.length) {
      const back = earliestReturn(borrowed.flatMap((r) => r.records));
      return { tone: 'wait', busy: pending > 0, title: 'Emprunté, à réserver', detail: back ? `Premier retour prévu le ${shortDate(back)}` : borrowed.map((r) => byId[r.libraryId].short).join(', ') };
    }
    if (results.some((r) => r.status === 'unknown')) return { tone: 'info', busy: pending > 0, title: 'Au catalogue', detail: 'Disponibilité à vérifier' };
    if (pending) return { tone: 'load', busy: true, title: 'Recherche en cours…', detail: libs.length > 1 ? `Dans vos ${libs.length} réseaux de bibliothèques` : libs[0]?.name || '' };
    if (results.length && results.every((r) => r.status === 'error')) return { tone: 'err', title: 'Catalogue injoignable', detail: 'Réessayez dans un instant' };
    if (results.some((r) => r.status === 'permission')) return { tone: 'setup', title: 'Autorisation nécessaire', detail: 'Pour interroger le catalogue' };
    const byTitle = results.some((r) => r.searchedBy?.includes('title'));
    return { tone: 'none', title: 'Pas dans vos bibliothèques', detail: byTitle ? 'Ni cette édition, ni une autre' : 'Cette édition n’y est pas' };
  }

  const STATUS_ORDER = { available: 0, unavailable: 1, unknown: 2, loading: 3, absent: 4, permission: 5, error: 6 };

  // --- Rendu des résultats (panneau et popup) ---

  function chipFor(result, records) {
    switch (result?.status) {
      case undefined: return h('span', { class: 'chip chip-load' }, h('span', { class: 'spinner' }), 'Recherche…');
      case 'available': {
        const n = records.filter((r) => !r.digital).reduce((s, r) => s + (r.availableCount || 0), 0);
        return h('span', { class: 'chip chip-ok' }, n ? plural(n, 'disponible', 'disponibles') : 'En numérique');
      }
      case 'unavailable': return h('span', { class: 'chip chip-wait' }, 'Emprunté');
      case 'unknown': return h('span', { class: 'chip chip-info' }, 'À vérifier');
      case 'absent': return h('span', { class: 'chip chip-none' }, 'Absent');
      case 'permission': return h('span', { class: 'chip chip-none' }, 'Accès à autoriser');
      default: return h('span', { class: 'chip chip-err' }, 'Injoignable');
    }
  }

  function itemStatus(item) {
    if (item.available === true) return item.onSiteOnly ? 'Sur place' : 'Disponible';
    if (item.dueDate) return `Retour ${shortDate(item.dueDate)}`;
    return item.status.replace(/\s*[–-]\s*retour prévu le.*$/i, '');
  }

  function renderItem(lib, item, settings, handlers) {
    const fav = isFavorite(settings, lib.id, item.branch);
    const tone = item.available === true ? 'ok' : item.available === false ? 'wait' : 'none';
    const where = lib.showGroups && item.group && !item.branch.includes(item.group) ? `${item.group} — ${item.branch}` : item.branch;
    const details = [item.callNumber && `Cote ${item.callNumber}`, item.location].filter(Boolean).join(' · ');
    return h('li', { class: `item${fav ? ' is-fav' : ''}` },
      h('button', {
        class: 'star',
        type: 'button',
        'aria-pressed': String(fav),
        title: fav ? 'Retirer de mes bibliothèques favorites' : 'Marquer comme ma bibliothèque',
        'aria-label': `${fav ? 'Retirer' : 'Ajouter'} ${item.branch} ${fav ? 'des' : 'aux'} favorites`,
        onclick: () => handlers.onToggleFavorite?.(lib.id, item.branch),
      }, icon('star', 14)),
      h('div', { class: 'item-main' },
        h('div', { class: 'item-line' },
          h('span', { class: 'item-branch', title: item.status }, where),
          h('span', { class: `item-status tone-${tone}` }, h('span', { class: 'dot' }), itemStatus(item))),
        details ? h('div', { class: 'item-details' }, details) : null));
  }

  /** Résumé d'un réseau où le livre réservé est acheminé vers la bibliothèque choisie par le lecteur. */
  function renderPickup(items) {
    const places = new Set(items.filter((i) => i.available === true).map((i) => i.branch)).size;
    const back = earliestReturn([{ items }]);
    const [tone, text] = places ? ['ok', `Disponible dans ${plural(places, 'bibliothèque', 'bibliothèques')} du réseau`]
      : items.some((i) => i.available === false) ? ['wait', back ? `Emprunté, retour prévu le ${shortDate(back)}` : 'Indisponible pour le moment']
        : ['none', 'Disponibilité à vérifier'];
    return h('div', { class: 'pickup' },
      h('span', { class: `item-status tone-${tone}` }, h('span', { class: 'dot' }), text),
      h('div', { class: 'item-details' }, 'Sur réservation, retrait dans la bibliothèque de votre choix'));
  }

  function renderRecord(lib, record, settings, handlers, ui) {
    const items = [...(record.items || [])].sort((a, b) => Number(isFavorite(settings, lib.id, b.branch)) - Number(isFavorite(settings, lib.id, a.branch)));
    const key = `${lib.id}:${record.id}`;
    const expanded = ui.expandedRecords.has(key);
    // Réseau avec retrait au choix : détail replié, sauf vos bibliothèques favorites.
    const folded = lib.pickupAnywhere ? items.filter((i) => isFavorite(settings, lib.id, i.branch)) : items.slice(0, 4);
    const visible = expanded ? items : folded;
    const meta = [record.year, record.type].filter(Boolean).join(' · ');
    const otherEdition = record.match === 'title' ? 'Autre édition (même titre)' : 'Autre édition';
    const tag = record.digital ? 'Version numérique' : record.sameEdition === false ? otherEdition : null;
    const url = safeUrl(record.url);
    let summary = null;
    if (!items.length && record.counts) summary = `${plural(record.counts.available, 'exemplaire disponible', 'exemplaires disponibles')} sur ${record.counts.total}`;
    else if (!items.length && !record.holdingsError) summary = 'Aucun exemplaire physique signalé';

    return h('div', { class: 'record' },
      h('div', { class: 'record-head' },
        h('div', { class: 'record-title' }, record.title || 'Notice sans titre'),
        meta || tag ? h('div', { class: 'record-meta' }, tag ? h('span', { class: 'tag' }, tag) : null, meta) : null),
      record.holdingsError ? h('p', { class: 'note' }, `Disponibilité non communiquée : ${record.holdingsError}`) : null,
      summary ? h('p', { class: 'note' }, summary) : null,
      lib.pickupAnywhere && items.length ? renderPickup(items) : null,
      visible.length ? h('ul', { class: 'items' }, visible.map((item) => renderItem(lib, item, settings, handlers))) : null,
      items.length > folded.length ? h('button', {
        class: 'more',
        type: 'button',
        onclick: () => { if (expanded) ui.expandedRecords.delete(key); else ui.expandedRecords.add(key); handlers.rerender?.(); },
      }, expanded ? 'Voir moins'
        : lib.pickupAnywhere ? `Voir le détail par bibliothèque (${plural(items.length, 'exemplaire', 'exemplaires')})`
          : `Voir les ${items.length - folded.length} autres exemplaires`) : null,
      url ? h('a', { class: 'cta', href: url, target: '_blank', rel: 'noopener noreferrer' }, record.availableCount > 0 ? 'Voir la fiche et réserver' : 'Réserver sur le catalogue', icon('external', 14)) : null);
  }

  function renderLibrary(lib, result, settings, handlers, ui) {
    const records = result?.records || [];
    const body = [];
    if (result?.status === 'absent') {
      const searched = result.searchedBy || [];
      const what = searched.includes('isbn') && searched.includes('title') ? 'Ni cette édition, ni une autre trouvée par titre.'
        : searched.includes('isbn') ? 'Cette édition n’est pas au catalogue.'
          : 'Aucun livre de ce titre au catalogue.';
      body.push(h('p', { class: 'note' }, `${what} `,
        safeUrl(result.searchUrl) ? h('a', { href: result.searchUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Chercher sur le catalogue') : null));
    } else if (result?.status === 'error') {
      body.push(h('p', { class: 'note' }, `${result.error}. `, h('button', { class: 'link', type: 'button', onclick: () => handlers.onRefresh?.() }, 'Réessayer')));
    } else if (result?.status === 'permission') {
      body.push(h('p', { class: 'note' }, 'Biblib n’a pas encore l’autorisation d’interroger ce catalogue. ',
        h('button', { class: 'link', type: 'button', onclick: () => handlers.onOpenOptions?.() }, 'Autoriser dans les réglages')));
    }
    for (const record of records) body.push(renderRecord(lib, record, settings, handlers, ui));
    return h('section', { class: `lib status-${result?.status || 'loading'}` },
      h('header', { class: 'lib-head' }, h('h3', { class: 'lib-name' }, lib.name), chipFor(result, records)),
      body);
  }

  function renderResults(container, state, settings, handlers, ui) {
    const libs = [...(state.libraries || [])].sort((a, b) =>
      (STATUS_ORDER[state.results[a.id]?.status || 'loading'] ?? 9) - (STATUS_ORDER[state.results[b.id]?.status || 'loading'] ?? 9));
    container.replaceChildren(...libs.map((lib) => renderLibrary(lib, state.results[lib.id], settings, handlers, ui)));
    if (state.noLibraries) {
      container.replaceChildren(h('div', { class: 'empty' },
        h('p', null, 'Choisissez vos bibliothèques (Paris, Bordeaux, Lyon…) pour savoir si ce livre y est disponible.'),
        h('button', { class: 'primary', type: 'button', onclick: () => handlers.onOpenOptions?.() }, 'Choisir mes bibliothèques')));
    }
  }

  // --- Panneau flottant (pages de livres) ---

  function mountPanel({ position = 'right', handlers = {} } = {}) {
    const host = document.createElement('div');
    host.setAttribute('data-biblib', '');
    const root = host.attachShadow({ mode: 'closed' });
    root.append(h('style', null, CSS));
    const ui = { open: false, expandedRecords: new Set() };
    let last = null;

    const pill = h('button', { class: 'pill', type: 'button', 'aria-expanded': 'false' });
    const bodyEl = h('div', { class: 'body' });
    const bookEl = h('div', { class: 'book' });
    const card = h('section', { class: 'card', role: 'dialog', 'aria-label': 'Biblib : disponibilité en bibliothèque', hidden: true },
      h('header', { class: 'card-head' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, icon('book', 14)), 'Biblib'),
        h('div', { class: 'head-actions' },
          h('button', { class: 'icon-btn', type: 'button', title: 'Actualiser', 'aria-label': 'Actualiser les résultats', onclick: () => handlers.onRefresh?.() }, icon('refresh', 16)),
          h('button', { class: 'icon-btn', type: 'button', title: 'Réduire', 'aria-label': 'Réduire le panneau', onclick: () => setOpen(false) }, icon('minus', 16)))),
      bookEl,
      bodyEl,
      h('footer', { class: 'card-foot' },
        h('span', { class: 'privacy', title: 'Réglages et favoris sont stockés uniquement sur cet appareil' }, icon('lock', 12), 'Données locales'),
        h('span', { class: 'foot-actions' },
          h('button', { class: 'link', type: 'button', onclick: () => handlers.onOpenOptions?.() }, 'Réglages'),
          h('button', { class: 'link', type: 'button', onclick: () => handlers.onHideSite?.() }, 'Masquer sur ce site'))));
    const wrap = h('div', { class: 'wrap', 'data-pos': position }, card, pill);
    root.append(wrap);
    pill.addEventListener('click', () => setOpen(!ui.open));
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.open) { setOpen(false); pill.focus(); } });
    document.documentElement.append(host);

    function setOpen(open) {
      ui.open = open;
      card.hidden = !open;
      pill.setAttribute('aria-expanded', String(open));
      wrap.classList.toggle('is-open', open);
    }

    function render() {
      if (!last) return;
      const { state, settings } = last;
      const s = summarize(state, settings);
      pill.className = `pill tone-${s.tone}`;
      pill.replaceChildren(
        h('span', { class: 'pill-icon' }, s.busy ? h('span', { class: 'spinner' }) : icon('book', 15)),
        h('span', { class: 'pill-text' }, h('span', { class: 'pill-title' }, s.title), s.detail ? h('span', { class: 'pill-detail' }, s.detail) : null));
      pill.setAttribute('aria-label', `Biblib : ${s.title}${s.detail ? `, ${s.detail}` : ''}`);
      const book = state.book || {};
      bookEl.replaceChildren(
        h('div', { class: 'book-title' }, book.title || 'Livre détecté'),
        h('div', { class: 'book-meta' }, [book.authors?.[0], book.isbns?.[0] ? `ISBN ${book.isbns[0]}` : 'recherche par titre'].filter(Boolean).join(' · ')));
      renderResults(bodyEl, state, settings, { ...handlers, rerender: render }, ui);
    }

    return {
      update(state, settings) { last = { state, settings }; render(); },
      open: () => setOpen(true),
      isOpen: () => ui.open,
      setPosition: (pos) => wrap.setAttribute('data-pos', pos),
      destroy: () => host.remove(),
    };
  }

  // --- Styles ---

  const CSS = `
:host { all: initial; }
.wrap, .popup {
  --bg: #ffffff; --fg: #1d1d1f; --muted: #66666e; --line: #e7e5e0; --soft: #f6f5f1;
  --accent: #284b8f; --accent-fg: #ffffff;
  --ok: #1f7a4d; --ok-bg: #e5f3eb; --wait: #9a5b00; --wait-bg: #fcf0dc;
  --info: #285e8f; --info-bg: #e6eef7; --none: #7a7a82; --none-bg: #efeeea; --err: #b42318; --err-bg: #fbe9e7;
  --shadow: 0 10px 34px rgba(20, 20, 30, .18), 0 2px 8px rgba(20, 20, 30, .08);
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--fg);
}
@media (prefers-color-scheme: dark) {
  .wrap, .popup {
    --bg: #1d1d21; --fg: #f1f1f3; --muted: #a3a3ad; --line: #34343a; --soft: #26262b;
    --accent: #8fb0ff; --accent-fg: #10131c;
    --ok: #5fd39a; --ok-bg: rgba(95, 211, 154, .14); --wait: #f2b55c; --wait-bg: rgba(242, 181, 92, .14);
    --info: #8fb7e8; --info-bg: rgba(143, 183, 232, .14); --none: #a3a3ad; --none-bg: #2c2c31; --err: #ff8a7a; --err-bg: rgba(255, 138, 122, .12);
    --shadow: 0 10px 34px rgba(0, 0, 0, .5);
  }
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }
.wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.wrap[data-pos="left"] { right: auto; left: 20px; align-items: flex-start; }

.pill { display: flex; align-items: center; gap: 10px; max-width: 320px; padding: 7px 14px 7px 7px; border: 1px solid var(--line);
  border-radius: 999px; background: var(--bg); box-shadow: var(--shadow); cursor: pointer; text-align: left; }
.pill:hover { border-color: color-mix(in srgb, var(--line) 50%, var(--fg) 25%); }
.pill:focus-visible, .icon-btn:focus-visible, .star:focus-visible, .cta:focus-visible, .link:focus-visible, .more:focus-visible, .primary:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px; }
.pill-icon { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--none-bg); color: var(--none); }
.pill-text { display: flex; flex-direction: column; min-width: 0; }
.pill-title { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pill-detail { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tone-ok .pill-icon { background: var(--ok-bg); color: var(--ok); }
.tone-wait .pill-icon { background: var(--wait-bg); color: var(--wait); }
.tone-info .pill-icon, .tone-load .pill-icon { background: var(--info-bg); color: var(--info); }
.tone-setup .pill-icon { background: var(--accent); color: var(--accent-fg); }
.tone-err .pill-icon { background: var(--err-bg); color: var(--err); }
.pill.tone-none { opacity: .88; }
.is-open .pill { display: none; }

.card { width: 380px; max-width: calc(100vw - 32px); max-height: min(72vh, 640px); display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden;
  animation: rise .16s ease-out; }
.card[hidden] { display: none; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; } .spinner { animation-duration: 2s; } }
.card-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 0 14px; }
.brand { display: flex; align-items: center; gap: 7px; font-weight: 700; letter-spacing: .01em; }
.brand-mark { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--accent); color: var(--accent-fg); }
.head-actions { display: flex; gap: 2px; }
.icon-btn { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; }
.icon-btn:hover { background: var(--soft); color: var(--fg); }
.book { padding: 8px 14px 12px; border-bottom: 1px solid var(--line); }
.book-title { font-size: 15px; font-weight: 650; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.book-meta { color: var(--muted); font-size: 12px; margin-top: 2px; }
.body { overflow-y: auto; overscroll-behavior: contain; padding: 4px 0; }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 14px; border-top: 1px solid var(--line); background: var(--soft); color: var(--muted); font-size: 11.5px; }
.privacy { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.foot-actions { display: inline-flex; gap: 12px; white-space: nowrap; }

.lib { padding: 12px 14px; }
.lib + .lib { border-top: 1px solid var(--line); }
.lib-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lib-name { margin: 0; font-size: 13px; font-weight: 650; }
.chip { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.chip-ok { background: var(--ok-bg); color: var(--ok); }
.chip-wait { background: var(--wait-bg); color: var(--wait); }
.chip-info, .chip-load { background: var(--info-bg); color: var(--info); }
.chip-none { background: var(--none-bg); color: var(--none); }
.chip-err { background: var(--err-bg); color: var(--err); }
.status-absent .lib-name, .status-error .lib-name, .status-permission .lib-name { color: var(--muted); }

.record { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
.record-title { font-weight: 600; }
.record-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; color: var(--muted); font-size: 12px; }
.tag { padding: 1px 7px; border-radius: 5px; background: var(--wait-bg); color: var(--wait); font-size: 11px; font-weight: 600; }
.note { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
.note a { color: var(--accent); }
.pickup { margin-top: 8px; }
.pickup .item-status { white-space: normal; }
.items { list-style: none; margin: 8px 0 0; padding: 0; }
.item { display: flex; align-items: flex-start; gap: 6px; padding: 5px 0; }
.item + .item { border-top: 1px dashed var(--line); }
.star { flex: none; display: grid; place-items: center; width: 22px; height: 22px; margin-top: -1px; border: 0; border-radius: 6px; background: transparent; color: var(--line); cursor: pointer; }
.star:hover { color: var(--muted); background: var(--soft); }
.star[aria-pressed="true"] { color: #e0a100; }
.star[aria-pressed="true"] svg { fill: currentColor; }
.item-main { flex: 1; min-width: 0; }
.item-line { display: flex; justify-content: space-between; gap: 10px; }
.item-branch { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.is-fav .item-branch { font-weight: 650; }
.item-status { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.item-status .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.item-status.tone-ok { color: var(--ok); }
.item-status.tone-wait { color: var(--wait); }
.item-status.tone-none { color: var(--none); }
.item-details { color: var(--muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.more, .link { padding: 0; border: 0; background: none; color: var(--accent); cursor: pointer; font-size: 12px; text-decoration: underline; text-underline-offset: 2px; }
.more { display: block; margin-top: 6px; }
.cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 7px 12px; border-radius: 8px; background: var(--accent); color: var(--accent-fg);
  font-weight: 600; font-size: 12.5px; text-decoration: none; }
.cta:hover { filter: brightness(1.08); }
.empty { padding: 16px 14px; }
.empty p { margin: 0 0 12px; color: var(--muted); }
.primary { padding: 8px 14px; border: 0; border-radius: 8px; background: var(--accent); color: var(--accent-fg); font-weight: 600; cursor: pointer; }
.spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

  globalThis.BiblibUI = { mountPanel, renderResults, summarize, CSS, h, icon };
})();
