// Point d'entrée sur les sites de livres : détecte le livre, lance la recherche
// dans les bibliothèques choisies et affiche la pastille Biblib.
(() => {
  'use strict';

  const { extractBook } = globalThis.BiblibExtract;
  const { mountPanel } = globalThis.BiblibUI;

  // Mêmes valeurs par défaut que lib/settings.js (un script de contenu ne peut pas importer de module).
  const DEFAULTS = { enabledLibraries: [], titleFallback: true, searchEditions: true, autoOpen: 'never', position: 'right', hiddenSites: [], favorites: {} };

  let settings = { ...DEFAULTS };
  let panel = null;
  let port = null;
  let state = null;
  let currentKey = null;
  let autoOpened = false;

  const bookKey = (b) => [b.isbns.join(','), b.editions.join(','), b.title, b.authors[0] || ''].join('|');

  async function loadSettings() {
    settings = await chrome.storage.local.get(DEFAULTS);
  }

  const handlers = {
    onRefresh: () => check({ force: true }),
    onOpenOptions: () => chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {}),
    async onToggleFavorite(libId, branch) {
      const favorites = { ...settings.favorites };
      const list = new Set(favorites[libId] || []);
      if (list.has(branch)) list.delete(branch); else list.add(branch);
      favorites[libId] = [...list];
      await chrome.storage.local.set({ favorites });
    },
    async onHideSite() {
      const hiddenSites = [...new Set([...settings.hiddenSites, location.hostname])];
      await chrome.storage.local.set({ hiddenSites });
    },
  };

  function render() {
    if (!state) return;
    if (!panel) panel = mountPanel({ position: settings.position, handlers });
    panel.update(state, settings);
  }

  function teardown() {
    if (port) port.disconnect();
    port = null;
    panel?.destroy();
    panel = null;
    state = null;
    currentKey = null;
    chrome.runtime.sendMessage({ type: 'clearBadge' }).catch(() => {});
  }

  function maybeAutoOpen() {
    if (autoOpened || settings.autoOpen !== 'available' || !panel || panel.isOpen()) return;
    if (Object.values(state.results).some((r) => r.status === 'available')) {
      autoOpened = true;
      panel.open();
    }
  }

  function startLookup(book, force) {
    if (port) port.disconnect();
    const myPort = chrome.runtime.connect({ name: 'biblib-lookup' });
    port = myPort;
    myPort.onMessage.addListener((message) => {
      if (port !== myPort) return;
      if (message.type === 'start') state.libraries = message.libraries;
      else if (message.type === 'result') state.results[message.result.libraryId] = message.result;
      else if (message.type === 'done') state.done = true;
      render();
      if (message.type === 'done') maybeAutoOpen();
    });
    myPort.onDisconnect.addListener(() => { if (port === myPort) port = null; });
    myPort.postMessage({
      type: 'lookup',
      force,
      book: {
        isbns: settings.searchEditions ? [...book.isbns, ...book.editions] : book.isbns,
        title: book.title,
        authors: book.authors,
        series: book.series,
      },
    });
  }

  async function check({ force = false } = {}) {
    const book = extractBook(document, location);
    if (!book) {
      if (state) teardown();
      return;
    }
    const key = bookKey(book);
    if (key === currentKey && !force) return;
    currentKey = key;
    autoOpened = false;
    await loadSettings();
    if (settings.hiddenSites.includes(location.hostname)) {
      teardown();
      return;
    }
    state = { book, libraries: [], results: {}, done: false, noLibraries: settings.enabledLibraries.length === 0 };
    render();
    if (!state.noLibraries) startLookup(book, force);
  }

  // Réglages modifiés (bibliothèques, favoris, position…) depuis la page de réglages ou un autre onglet.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? DEFAULTS[key];
    if (changes.hiddenSites && settings.hiddenSites.includes(location.hostname)) return teardown();
    if (changes.position) panel?.setPosition(settings.position);
    if (changes.enabledLibraries || changes.searchEditions || changes.titleFallback || changes.hiddenSites) {
      currentKey = null;
      check();
      return;
    }
    render();
  });

  // La fenêtre de l'extension demande ce qui est affiché sur la page.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'getPageState') sendResponse({ state, settings });
    return false;
  });

  // Sites qui changent de livre sans recharger la page (Amazon : choix du format, navigation interne).
  let lastUrl = location.href;
  const watcher = setInterval(() => {
    // Extension rechargée ou désinstallée : ce script n'a plus accès à chrome.runtime.
    if (!chrome.runtime?.id) {
      clearInterval(watcher);
      panel?.destroy();
      return;
    }
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    setTimeout(check, 800);
  }, 1000);

  check();
})();
