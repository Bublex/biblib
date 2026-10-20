import { LIBRARIES, getLibrary, originPatterns } from '../lib/libraries.js';
import { getSettings, saveSettings } from '../lib/settings.js';
import { lookupLibrary } from '../lib/lookup.js';
import { humanError } from '../lib/net.js';
import { stripAccents } from '../lib/text.js';

const TEST_BOOK = { isbns: ['9782070612758', '9782070408504'], title: 'Le Petit Prince', authors: ['Antoine de Saint-Exupéry'] };

const $ = (id) => document.getElementById(id);
let settings = await getSettings();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

// --- Bibliothèques ---

async function hasPermission(lib) {
  return chrome.permissions.contains({ origins: originPatterns(lib) });
}

function setEnabled(id, enabled) {
  const set = new Set(settings.enabledLibraries);
  if (enabled) set.add(id); else set.delete(id);
  // Conserve l'ordre du registre pour un affichage stable.
  settings.enabledLibraries = LIBRARIES.map((l) => l.id).filter((x) => set.has(x));
  return saveSettings({ enabledLibraries: settings.enabledLibraries });
}

async function onToggle(lib, checkbox) {
  if (checkbox.checked) {
    // La demande d'autorisation doit partir directement du clic (geste utilisateur).
    const granted = await chrome.permissions.request({ origins: originPatterns(lib) });
    if (!granted) {
      checkbox.checked = false;
      return;
    }
    await setEnabled(lib.id, true);
  } else {
    await setEnabled(lib.id, false);
    // Bordeaux et Bordeaux Métropole partagent le même serveur : on ne retire que ce qui ne sert plus.
    const stillUsed = new Set(settings.enabledLibraries.flatMap((id) => originPatterns(getLibrary(id))));
    const unused = originPatterns(lib).filter((origin) => !stillUsed.has(origin));
    if (unused.length) await chrome.permissions.remove({ origins: unused }).catch(() => {});
  }
  // L'affichage est rafraîchi par chrome.storage.onChanged.
}

async function runTest(lib, output) {
  output.className = 'test-result';
  output.textContent = 'Test en cours…';
  try {
    const result = await lookupLibrary(lib, TEST_BOOK, { titleFallback: false });
    const items = result.records.flatMap((r) => r.items || []);
    const available = items.filter((i) => i.available === true).length;
    const holdingsError = result.records.find((r) => r.holdingsError)?.holdingsError;
    if (!result.records.length) {
      output.textContent = 'Catalogue joignable, mais « Le Petit Prince » n’y a pas été trouvé.';
    } else if (holdingsError) {
      output.classList.add('warn');
      output.textContent = `Recherche OK, mais disponibilité indisponible : ${holdingsError}`;
    } else {
      output.classList.add('ok');
      output.textContent = `Catalogue OK : « Le Petit Prince » trouvé, ${items.length} exemplaire${items.length > 1 ? 's' : ''} dont ${available} disponible${available > 1 ? 's' : ''}.`;
    }
  } catch (error) {
    output.classList.add('err');
    output.textContent = `Échec : ${humanError(error)}`;
  }
}

// « merignac » trouve « Mérignac », « baroeul » trouve « Barœul » : comparaison sans accents ni majuscules.
const fold = (s) => stripAccents(s).toLowerCase().replace(/œ/g, 'oe').replace(/’/g, "'");
const BY_CITY = [...LIBRARIES].sort((a, b) => a.city.localeCompare(b.city, 'fr'));

function filterLibraries() {
  const words = fold($('libFilter').value).split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const row of $('libs').children) {
    row.hidden = !words.every((w) => row.dataset.search.includes(w));
    if (!row.hidden) shown++;
  }
  $('libsEmpty').hidden = shown > 0;
}

async function renderLibraries() {
  const list = $('libs');
  const rows = await Promise.all(BY_CITY.map(async (lib) => {
    const enabled = settings.enabledLibraries.includes(lib.id);
    const permitted = enabled && (await hasPermission(lib));
    const output = el('p', { class: 'test-result', role: 'status' });
    const checkbox = el('input', { type: 'checkbox', id: `lib-${lib.id}`, checked: enabled });
    checkbox.addEventListener('change', () => onToggle(lib, checkbox));
    const actions = [];
    if (enabled && !permitted) {
      output.className = 'test-result warn';
      output.textContent = 'Autorisation retirée : Biblib ne peut plus interroger ce catalogue.';
      actions.push(el('button', {
        type: 'button',
        class: 'secondary small',
        onclick: async () => {
          if (await chrome.permissions.request({ origins: originPatterns(lib) })) renderLibraries();
        },
      }, 'Autoriser'));
    } else if (enabled) {
      actions.push(el('button', { type: 'button', class: 'secondary small', onclick: () => runTest(lib, output) }, 'Tester'));
    }
    const host = new URL(lib.base).host;
    return el('li', { class: `lib${enabled ? ' is-on' : ''}`, 'data-search': fold(`${lib.city} ${lib.name} ${lib.short} ${host}`) },
      el('label', { class: 'lib-label', for: `lib-${lib.id}` },
        checkbox,
        el('span', { class: 'switch', 'aria-hidden': 'true' }),
        el('span', { class: 'lib-text' },
          el('span', { class: 'lib-city' }, lib.city),
          el('span', { class: 'lib-name' }, lib.name),
          el('span', { class: 'lib-host' }, host))),
      actions.length ? el('div', { class: 'lib-actions' }, actions) : null,
      output);
  }));
  list.replaceChildren(...rows);
  filterLibraries();
}

// --- Préférences de recherche ---

function bindPreferences() {
  for (const id of ['searchEditions', 'titleFallback']) {
    $(id).checked = Boolean(settings[id]);
    $(id).addEventListener('change', () => saveSettings({ [id]: $(id).checked }));
  }
  for (const id of ['autoOpen', 'position']) {
    $(id).value = settings[id];
    $(id).addEventListener('change', () => saveSettings({ [id]: $(id).value }));
  }
}

// --- Favoris et sites masqués ---

function renderFavorites() {
  const entries = Object.entries(settings.favorites || {}).flatMap(([libId, branches]) => branches.map((branch) => ({ libId, branch })));
  const list = $('favorites');
  if (!entries.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Aucune pour l’instant.'));
    return;
  }
  list.replaceChildren(...entries.map(({ libId, branch }) => el('li', { class: 'chip' },
    el('span', {}, branch, el('small', {}, ` · ${getLibrary(libId)?.short || libId}`)),
    el('button', {
      type: 'button',
      'aria-label': `Retirer ${branch} des favorites`,
      onclick: async () => {
        const favorites = { ...settings.favorites, [libId]: settings.favorites[libId].filter((b) => b !== branch) };
        await saveSettings({ favorites });
      },
    }, '×'))));
}

function renderHiddenSites() {
  $('hidden-section').hidden = !settings.hiddenSites.length;
  $('hiddenSites').replaceChildren(...settings.hiddenSites.map((site) => el('li', { class: 'chip' },
    el('span', {}, site),
    el('button', {
      type: 'button',
      'aria-label': `Réafficher Biblib sur ${site}`,
      onclick: () => saveSettings({ hiddenSites: settings.hiddenSites.filter((s) => s !== site) }),
    }, 'Réafficher'))));
}

$('clearCache').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clearCache' });
  $('cacheStatus').textContent = 'Cache vidé.';
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  if (changes.favorites) renderFavorites();
  if (changes.hiddenSites) renderHiddenSites();
  if (changes.enabledLibraries) renderLibraries();
});

$('libFilter').addEventListener('input', filterLibraries);

bindPreferences();
renderLibraries();
renderFavorites();
renderHiddenSites();
