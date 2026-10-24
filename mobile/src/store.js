// État de l'app : réglages, livres scannés et recherches en cours.
// Réglages et livres sont enregistrés sur le téléphone (AsyncStorage), sans compte ni serveur Biblib.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { LIBRARIES, getLibrary, libraryMeta } from '../../extension/lib/libraries.js';
import { toIsbn13 } from '../../extension/lib/isbn.js';
import '../../extension/content/ui.js';
import { searchBook, clearCache } from './search.js';

// Résumé de la pastille de l'extension (« Disponible à Mériadeck », « Emprunté, à réserver »…).
export const { summarize } = globalThis.BiblibUI;

const STORAGE_KEY = 'biblib:v1';
const MAX_BOOKS = 200;

export const DEFAULT_SETTINGS = {
  enabledLibraries: [],
  // Si l'édition scannée n'est pas trouvée, chercher par titre et auteur (titre obtenu auprès de la BnF).
  titleFallback: true,
  // { [libraryId]: [nom de bibliothèque/annexe, …] }
  favorites: {},
};

let state = {
  ready: false,
  settings: DEFAULT_SETTINGS,
  // { id, isbn?, title?, authors?, scannedAt, summary?, checkedAt? } — le plus récent en premier.
  books: [],
  // id -> { book, libraries, results, done } : recherches de cette session (non enregistrées).
  lookups: {},
};

const listeners = new Set();
const controllers = new Map();

function setState(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Le sélecteur doit renvoyer une valeur stable (un morceau de l'état, pas un objet recréé). */
export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const getState = () => state;

// --- Enregistrement ---

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: state.settings, books: state.books }));
  } catch {
    // Stockage indisponible : l'app reste utilisable pour cette session.
  }
}

export async function loadState() {
  let saved = null;
  try {
    saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || 'null');
  } catch {
    saved = null;
  }
  const settings = { ...DEFAULT_SETTINGS, ...saved?.settings };
  // Bibliothèque retirée du registre depuis la dernière version : on l'oublie.
  settings.enabledLibraries = settings.enabledLibraries.filter((id) => getLibrary(id));
  setState({ ready: true, settings, books: Array.isArray(saved?.books) ? saved.books : [] });
}

// --- Livres ---

const enabledLibraries = () => state.settings.enabledLibraries.map(getLibrary).filter(Boolean);

function updateBook(id, patch) {
  setState({ books: state.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}

/** Ajoute (ou remonte en tête) un livre scanné ou saisi, et lance sa recherche. Renvoie son identifiant. */
export function addBook(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  const isbn = toIsbn13(text);
  const id = isbn || `titre:${text.toLowerCase()}`;
  const existing = state.books.find((b) => b.id === id);
  const book = { ...(existing || (isbn ? { id, isbn } : { id, title: text, authors: [] })), scannedAt: Date.now() };
  setState({ books: [book, ...state.books.filter((b) => b.id !== id)].slice(0, MAX_BOOKS) });
  persist();
  // Livre déjà cherché pendant cette session : on garde ses résultats.
  if (!state.lookups[id]) runLookup(id);
  return id;
}

export function removeBook(id) {
  controllers.get(id)?.abort();
  const { [id]: _, ...lookups } = state.lookups;
  setState({ books: state.books.filter((b) => b.id !== id), lookups });
  persist();
}

export function clearBooks() {
  for (const controller of controllers.values()) controller.abort();
  setState({ books: [], lookups: {} });
  persist();
}

// --- Recherche ---

export async function runLookup(id, { force = false } = {}) {
  const book = state.books.find((b) => b.id === id);
  if (!book) return;
  const libs = enabledLibraries();
  const setLookup = (patch) => setState({ lookups: { ...state.lookups, [id]: { ...state.lookups[id], ...patch } } });
  if (!libs.length) {
    setLookup({ book, libraries: [], results: {}, done: true, noLibraries: true });
    return;
  }

  controllers.get(id)?.abort();
  const controller = new AbortController();
  controllers.set(id, controller);
  setLookup({ book, libraries: libs.map(libraryMeta), results: {}, done: false, noLibraries: false });

  try {
    const { info } = await searchBook(book, libs, {
      titleFallback: state.settings.titleFallback,
      force,
      signal: controller.signal,
      onResult: (result) => {
        if (controller.signal.aborted) return;
        setLookup({ results: { ...state.lookups[id].results, [result.libraryId]: result } });
      },
    });
    if (controller.signal.aborted) return;
    setLookup({ done: true });
    const current = state.books.find((b) => b.id === id);
    if (!current) return;
    // Résumé enregistré avec le livre : la liste reste parlante après un redémarrage de l'app.
    const { tone, title, detail } = summarize(state.lookups[id], state.settings);
    updateBook(id, {
      ...(!current.title && info?.title ? { title: info.title, authors: info.authors } : {}),
      summary: { tone, title, detail },
      checkedAt: Date.now(),
    });
    persist();
  } catch {
    // Recherche annulée (livre retiré, nouvelle recherche lancée).
  } finally {
    if (controllers.get(id) === controller) controllers.delete(id);
  }
}

// --- Réglages ---

function saveSettings(patch) {
  setState({ settings: { ...state.settings, ...patch } });
  persist();
}

export function setLibraryEnabled(libId, enabled) {
  const set = new Set(state.settings.enabledLibraries);
  if (enabled) set.add(libId); else set.delete(libId);
  // Ordre du registre, pour un affichage stable.
  saveSettings({ enabledLibraries: LIBRARIES.map((l) => l.id).filter((x) => set.has(x)) });
  // Les résultats affichés ne correspondent plus aux bibliothèques choisies.
  setState({ lookups: {} });
}

export function setTitleFallback(value) {
  saveSettings({ titleFallback: value });
  clearCache();
  setState({ lookups: {} });
}

export function toggleFavorite(libId, branch) {
  const list = new Set(state.settings.favorites[libId] || []);
  if (list.has(branch)) list.delete(branch); else list.add(branch);
  saveSettings({ favorites: { ...state.settings.favorites, [libId]: [...list] } });
}
