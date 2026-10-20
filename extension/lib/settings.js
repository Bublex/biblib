// Réglages de l'extension. Tout est stocké dans chrome.storage.local, donc uniquement sur cet appareil
// (pas de chrome.storage.sync, qui passerait par les serveurs de Google).

export const DEFAULT_SETTINGS = {
  enabledLibraries: [],
  // Si l'ISBN n'est pas trouvé, chercher par titre + auteur (autres éditions).
  titleFallback: true,
  // Chercher aussi les ISBN des autres éditions listées sur la page (Babelio…).
  searchEditions: true,
  // 'never' | 'available' : ouvrir le panneau automatiquement quand un exemplaire est disponible.
  autoOpen: 'never',
  position: 'right',
  hiddenSites: [],
  // { [libraryId]: [nom de bibliothèque/annexe, …] }
  favorites: {},
};

export async function getSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

export async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}
