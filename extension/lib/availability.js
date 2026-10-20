// Interprétation des statuts d'exemplaires, très hétérogènes d'un catalogue à l'autre
// (« Disponible », « En rayon », « Prêté (Retour prévu le : 20/10/2026) », « Sorti », « EN TRANSIT »…).

import { stripAccents } from './text.js';

const UNAVAILABLE = /(non disponible|indisponible|pas disponible|prete|pret en cours|emprunt|sorti|retard|reserv|transit|en commande|commande|traitement|reparation|reliure|perdu|manquant|en cours|mis de cote|navette|retire|equipement|catalogage|pilon|desherb|bloque|attente|absent|introuvable|exposition|en pret|retour|transfer)/;
const AVAILABLE = /(disponible|en rayon|rayon|libre|sur place|consultable|present|en magasin)/;
const ON_SITE = /(sur place|consultation|exclu du pret|non empruntable|non pretable|ne sort pas|reference|a consulter)/;

/** true = disponible, false = indisponible, null = impossible à dire. */
export function classifyStatus(text) {
  const t = stripAccents(String(text ?? '')).toLowerCase();
  if (!t.trim()) return null;
  // « Exclu du prêt », « à consulter sur place » : le document est là, mais ne sort pas.
  const withoutOnSite = t.replace(/exclu du pret|a consulter sur place|consultation sur place/g, ' ');
  if (UNAVAILABLE.test(withoutOnSite)) return false;
  if (AVAILABLE.test(t) || withoutOnSite !== t) return true;
  return null;
}

export function isOnSiteOnly(text) {
  return ON_SITE.test(stripAccents(String(text ?? '')).toLowerCase());
}

/** Première date jj/mm/aaaa trouvée, au format ISO (aaaa-mm-jj), sinon null. */
export function parseFrenchDate(text) {
  const m = String(text ?? '').match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** « 2026-11-07 » -> « 7 nov. » (ou « 7 nov. 2027 » si autre année). */
export function formatShortDate(iso, now = new Date()) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d} ${months[m - 1]}${y !== now.getFullYear() ? ` ${y}` : ''}`;
}
