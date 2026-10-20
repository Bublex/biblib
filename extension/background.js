// Service worker : reçoit le livre détecté par la page, interroge les catalogues choisis
// et renvoie les résultats au fur et à mesure. Aucune donnée ne quitte l'appareil,
// hormis les requêtes de recherche (ISBN, titre, auteur) envoyées aux catalogues sélectionnés.

import { getLibrary, originPatterns, libraryMeta } from './lib/libraries.js';
import { lookupLibrary } from './lib/lookup.js';
import { getSettings } from './lib/settings.js';
import { humanError } from './lib/net.js';

const CACHE_TTL = 15 * 60 * 1000;
const LOOKUP_TIMEOUT = 45000;

// --- Cache des résultats (mémoire + chrome.storage.session, effacé à la fermeture du navigateur) ---

const memoryCache = new Map();

function cacheKey(lib, book, settings) {
  return ['lookup', lib.id, (book.isbns || []).join(','), book.title || '', (book.authors || [])[0] || '', settings.titleFallback ? 1 : 0].join('|');
}

async function cacheGet(key) {
  let entry = memoryCache.get(key);
  if (!entry) entry = (await chrome.storage.session.get(key))[key];
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.value;
  return null;
}

async function cacheSet(key, value) {
  const entry = { at: Date.now(), value };
  memoryCache.set(key, entry);
  try {
    await chrome.storage.session.set({ [key]: entry });
  } catch {
    // Quota de session dépassé : on vide le cache persistant, la mémoire suffit.
    await chrome.storage.session.clear();
  }
}

async function clearCache() {
  memoryCache.clear();
  await chrome.storage.session.clear();
}

// --- Recherche ---

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function lookupOne(lib, book, settings, { force, signal }) {
  if (!(await chrome.permissions.contains({ origins: originPatterns(lib) }))) {
    return { libraryId: lib.id, status: 'permission' };
  }
  const key = cacheKey(lib, book, settings);
  if (!force) {
    const cached = await cacheGet(key);
    if (cached) return cached;
  }
  try {
    const result = await withTimeout(lookupLibrary(lib, book, { titleFallback: settings.titleFallback, signal }), LOOKUP_TIMEOUT);
    await cacheSet(key, result);
    return result;
  } catch (error) {
    if (signal.aborted) return null;
    console.warn(`[Biblib] ${lib.id}`, error);
    return { libraryId: lib.id, status: 'error', error: humanError(error) };
  }
}

async function runLookup(port, book, force) {
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  const send = (message) => {
    try { port.postMessage(message); } catch { controller.abort(); }
  };

  const settings = await getSettings();
  const libs = settings.enabledLibraries.map(getLibrary).filter(Boolean);
  send({ type: 'start', libraries: libs.map(libraryMeta) });

  const results = await Promise.all(libs.map(async (lib) => {
    const result = await lookupOne(lib, book, settings, { force, signal: controller.signal });
    if (result) send({ type: 'result', result });
    return result;
  }));

  const tabId = port.sender?.tab?.id;
  if (tabId !== undefined) updateBadge(tabId, results.filter(Boolean));
  send({ type: 'done' });
}

// --- Badge de l'icône ---

function updateBadge(tabId, results) {
  const available = results.some((r) => r.status === 'available');
  const present = results.some((r) => r.status === 'unavailable' || r.status === 'unknown');
  const text = available ? '✓' : present ? '•' : '';
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ tabId, color: available ? '#1f7a4d' : '#b26b00' }).catch(() => {});
}

// --- Messages ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'biblib-lookup') return;
  port.onMessage.addListener((message) => {
    if (message?.type === 'lookup' && message.book) runLookup(port, message.book, Boolean(message.force));
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      break;
    case 'clearCache':
      clearCache().then(() => sendResponse({ ok: true }));
      return true;
    case 'clearBadge':
      if (sender.tab?.id !== undefined) chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' }).catch(() => {});
      break;
    default:
      break;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
