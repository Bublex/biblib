// Utilitaires ISBN : nettoyage, validation, conversion ISBN-10 <-> ISBN-13.

export function cleanIsbn(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^0-9X]/g, '');
}

export function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

export function isValidIsbn13(s) {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

/** Renvoie l'ISBN-13 correspondant, ou null si la valeur n'est pas un ISBN valide. */
export function toIsbn13(raw) {
  const s = cleanIsbn(raw);
  if (isValidIsbn13(s)) return s;
  if (!isValidIsbn10(s)) return null;
  const base = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 ? 3 : 1);
  return base + ((10 - (sum % 10)) % 10);
}

/** Renvoie l'ISBN-10 correspondant (uniquement pour les préfixes 978), sinon null. */
export function toIsbn10(raw) {
  const s = toIsbn13(raw);
  if (!s || !s.startsWith('978')) return null;
  const core = s.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

/** Liste dédoublonnée d'ISBN-13 valides, dans l'ordre d'apparition. */
export function normalizeIsbns(list) {
  const out = [];
  for (const raw of list || []) {
    const isbn = toIsbn13(raw);
    if (isbn && !out.includes(isbn)) out.push(isbn);
  }
  return out;
}
