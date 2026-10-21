// API chrome.* simulée pour afficher la vraie page de réglages hors de l'extension (vidéo de présentation).
// La demande d'autorisation reste en attente jusqu'à ce que la vidéo clique sur « Autoriser » (window.grantPermission).
(() => {
  const store = { enabledLibraries: ['bordeaux'], favorites: {}, hiddenSites: [] };
  const listeners = [];
  let grant = null;
  window.grantPermission = () => grant?.(true);
  window.chrome = {
    storage: {
      local: {
        async get(defaults) {
          return { ...defaults, ...structuredClone(store) };
        },
        async set(patch) {
          const changes = {};
          for (const [key, value] of Object.entries(patch)) {
            changes[key] = { oldValue: store[key], newValue: value };
            store[key] = value;
          }
          for (const fn of listeners) fn(changes, 'local');
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    permissions: {
      contains: async () => true,
      request: () => new Promise((resolve) => { grant = resolve; }),
      remove: async () => true,
    },
    runtime: { sendMessage: async () => ({}), openOptionsPage() {} },
  };
})();
