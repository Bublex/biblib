import { toIsbn13 } from '../lib/isbn.js';
import { getSettings } from '../lib/settings.js';

const { renderResults, CSS } = globalThis.BiblibUI;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

const $ = (id) => document.getElementById(id);
let settings = await getSettings();
let state = null;
let port = null;
let lastBook = null;
const ui = { expandedRecords: new Set() };

const handlers = {
  onOpenOptions: () => chrome.runtime.openOptionsPage(),
  onRefresh: () => lastBook && lookup(lastBook, true),
  async onToggleFavorite(libId, branch) {
    const list = new Set(settings.favorites[libId] || []);
    if (list.has(branch)) list.delete(branch); else list.add(branch);
    await chrome.storage.local.set({ favorites: { ...settings.favorites, [libId]: [...list] } });
  },
  rerender: render,
};

function render() {
  if (!state) return;
  $('current').hidden = false;
  $('hint').hidden = true;
  $('bookTitle').textContent = state.book.title || (state.book.isbns[0] ? `ISBN ${state.book.isbns[0]}` : 'Recherche');
  $('bookMeta').textContent = [state.book.authors?.[0], state.book.isbns?.[0] && state.book.title ? `ISBN ${state.book.isbns[0]}` : null].filter(Boolean).join(' · ');
  renderResults($('results'), state, settings, handlers, ui);
}

function lookup(book, force = false) {
  lastBook = book;
  state = { book, libraries: [], results: {}, done: false, noLibraries: settings.enabledLibraries.length === 0 };
  render();
  if (state.noLibraries) return;
  port?.disconnect();
  const myPort = chrome.runtime.connect({ name: 'biblib-lookup' });
  port = myPort;
  myPort.onMessage.addListener((message) => {
    if (port !== myPort) return;
    if (message.type === 'start') state.libraries = message.libraries;
    else if (message.type === 'result') state.results[message.result.libraryId] = message.result;
    else if (message.type === 'done') state.done = true;
    render();
  });
  myPort.postMessage({ type: 'lookup', book, force });
}

$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('openPhone').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#telephone') }));

$('searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = $('query').value.trim();
  if (!query) return;
  const isbn = toIsbn13(query);
  lookup(isbn ? { isbns: [isbn], title: '', authors: [] } : { isbns: [], title: query, authors: [] });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  render();
});

// Livre détecté sur l'onglet actif : on relance la recherche (les résultats sont en cache, c'est instantané).
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (tab?.id !== undefined) {
  try {
    const page = await chrome.tabs.sendMessage(tab.id, { type: 'getPageState' });
    const book = page?.state?.book;
    if (book) {
      lookup({
        isbns: settings.searchEditions ? [...book.isbns, ...book.editions] : book.isbns,
        title: book.title,
        authors: book.authors,
        series: book.series,
      });
    }
  } catch {
    // Pas de script Biblib sur cet onglet (site non pris en charge).
  }
}
if (!state) $('query').focus();
