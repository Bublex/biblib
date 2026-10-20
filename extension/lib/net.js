// Requêtes réseau vers les catalogues : délai maximal, annulation, décodage du jeu de caractères.

export const DEFAULT_TIMEOUT = 20000;

export async function request(url, { method = 'GET', headers, body, credentials = 'omit', timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const signals = [AbortSignal.timeout(timeout)];
  if (signal) signals.push(signal);
  return fetch(url, {
    method,
    headers,
    body,
    credentials,
    cache: 'no-store',
    // Le catalogue n'a pas à savoir depuis quelle page vous consultez.
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any(signals),
  });
}

export async function requestJson(url, options) {
  const res = await request(url, options);
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
}

/** Texte d'une réponse, décodé selon l'en-tête Content-Type ou le jeu de caractères par défaut fourni. */
export async function readText(res, fallbackCharset = 'utf-8') {
  const buffer = await res.arrayBuffer();
  const declared = (res.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i);
  try {
    return new TextDecoder(declared ? declared[1] : fallbackCharset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

/** Message d'erreur compréhensible pour l'interface. */
export function humanError(error) {
  if (!error) return 'Erreur inconnue';
  if (error.name === 'TimeoutError') return 'Le catalogue met trop de temps à répondre';
  if (error.name === 'AbortError') return 'Recherche annulée';
  if (error instanceof HttpError) {
    if (error.status === 403 || error.status === 401) return 'Le catalogue refuse la connexion';
    if (error.status >= 500) return 'Le catalogue rencontre une erreur';
    return `Le catalogue a répondu ${error.status}`;
  }
  if (error instanceof TypeError) return 'Catalogue injoignable (réseau)';
  return error.message || 'Erreur inconnue';
}
