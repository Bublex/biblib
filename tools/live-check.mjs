// Vérifie en direct que chaque catalogue répond toujours comme attendu (à lancer de temps en temps :
// les portails changent sans prévenir). Utilise le code de l'extension tel quel.
// Usage : node tools/live-check.mjs [id-bibliotheque…] [--isbn=9782070612758] [--suggest]
//
// Node n'a pas de magasin de cookies : on en simule un, comme le fait Chrome pour l'extension.
import { LIBRARIES, getLibrary } from '../extension/lib/libraries.js';
import { lookupLibrary } from '../extension/lib/lookup.js';
import { humanError } from '../extension/lib/net.js';

const args = process.argv.slice(2);
const isbn = (args.find((a) => a.startsWith('--isbn=')) || '--isbn=9782070612758').slice(7);
const ids = args.filter((a) => !a.startsWith('--'));
const libs = ids.length ? ids.map(getLibrary).filter(Boolean) : LIBRARIES;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const jars = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}, hops = 0) => {
  const { host } = new URL(url);
  const jar = jars.get(host) || new Map();
  jars.set(host, jar);
  const withCookies = options.credentials === 'include';
  const headers = new Headers(options.headers);
  // Certains pare-feu (Bordeaux) coupent un client qui se dit « Chrome » sans en avoir l'empreinte TLS :
  // LIVE_UA=node conserve l'agent par défaut de Node.
  if (process.env.LIVE_UA !== 'node') headers.set('User-Agent', UA);
  if (withCookies && jar.size) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  // Redirections suivies à la main pour conserver les cookies posés à chaque étape (comme Chrome).
  const res = await realFetch(url, { ...options, headers, redirect: withCookies ? 'manual' : 'follow' });
  if (withCookies) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const location = res.headers.get('location');
    if (location && res.status >= 300 && res.status < 400 && hops < 5) {
      return globalThis.fetch(new URL(location, url).href, { ...options, method: 'GET', body: undefined }, hops + 1);
    }
  }
  return res;
};

// --suggest : vérifie seulement que les pages de suggestion d'achat existent toujours.
// Syracuse répond 200 même pour une page supprimée (« Cette page n'existe plus ») : on lit donc le texte.
if (args.includes('--suggest')) {
  let broken = 0;
  await Promise.all(libs.filter((lib) => lib.suggestUrl).map(async (lib) => {
    try {
      const res = await fetch(lib.suggestUrl, { signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      const ok = res.ok && /suggest|acquisition/i.test(text) && !/n['’]existe plus|<title>\s*Erreur/i.test(text);
      if (!ok) broken++;
      console.log(`${ok ? '✓' : '✗'} ${lib.id.padEnd(19)} HTTP ${res.status} ${lib.suggestUrl}`);
    } catch (error) {
      broken++;
      console.log(`✗ ${lib.id.padEnd(19)} ${humanError(error)} ${lib.suggestUrl}`);
    }
  }));
  process.exit(broken ? 1 : 0);
}

const book = { isbns: [isbn], title: '', authors: [] };
let failures = 0;
await Promise.all(libs.map(async (lib) => {
  const started = Date.now();
  try {
    const result = await lookupLibrary(lib, book, { titleFallback: false });
    const items = result.records.flatMap((r) => r.items || []);
    const holdingsError = result.records.find((r) => r.holdingsError)?.holdingsError;
    const line = result.records.length
      ? `${result.records.length} notice(s), ${items.length} exemplaire(s), ${items.filter((i) => i.available).length} disponible(s)`
      : 'aucune notice';
    console.log(`${holdingsError ? '⚠' : '✓'} ${lib.id.padEnd(19)} ${result.status.padEnd(11)} ${line}${holdingsError ? ` — ${holdingsError}` : ''} (${Date.now() - started} ms)`);
    if (result.records[0]) console.log(`  ${result.records[0].title} → ${result.records[0].url}`);
  } catch (error) {
    failures++;
    console.log(`✗ ${lib.id.padEnd(19)} ${humanError(error)} [${error.cause?.code || error.name}] (${Date.now() - started} ms)`);
  }
}));
process.exitCode = failures ? 1 : 0;
