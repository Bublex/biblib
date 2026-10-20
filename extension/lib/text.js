// Outils texte : entités HTML, nettoyage de titres, comparaison titre/auteur.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', auml: 'ä',
  ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  oelig: 'œ', aelig: 'æ', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â',
  Ccedil: 'Ç', Ocirc: 'Ô', OElig: 'Œ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—', deg: '°', middot: '·',
  copy: '©', reg: '®', euro: '€',
};

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ent) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ent] ?? match;
  });
}

/** Texte brut d'un fragment HTML (sans commentaires, scripts ni balises). */
export function stripTags(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

export function stripAccents(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Titre de notice lisible : sans « [Livre] », sans mention de responsabilité après « / ». */
export function cleanRecordTitle(raw) {
  let t = decodeEntities(String(raw ?? '')).replace(/\s+/g, ' ').trim();
  t = t.replace(/\[(livre|texte imprim[ée]|texte|bande dessin[ée]e|document [^\]]*|ressource [^\]]*|enregistrement [^\]]*|image [^\]]*)\]/gi, '');
  const slash = t.indexOf(' / ');
  if (slash > 0) t = t.slice(0, slash);
  return t
    .replace(/\s*\/\s*(\d+)\s*$/, ' ($1)') // « … sorciers /1 » (numéro de volume, Toulouse)
    .replace(/^[\s.,;:/-]+/, '')
    .replace(/\s*[/:;,.]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'a', 'au', 'aux', 'en', 'sur',
  'the', 'of', 'an', 'and', 'tome', 't', 'vol', 'volume', 'livre', 'roman', 'edition', 'integrale',
]);

export function titleTokens(s) {
  return stripAccents(String(s ?? '').toLowerCase())
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w));
}

/** Coefficient de Dice entre les mots significatifs de deux titres (0 à 1). */
export function titleSimilarity(a, b) {
  const A = new Set(titleTokens(a));
  const B = new Set(titleTokens(b));
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return (2 * common) / (A.size + B.size);
}

/** Nom de famille probable : « Antoine de Saint-Exupéry » -> « Saint-Exupéry », « Rowling, J. K. » -> « Rowling ». */
export function lastName(author) {
  const a = String(author ?? '').replace(/\(.*?\)/g, '').trim();
  if (!a) return '';
  if (a.includes(',')) return a.split(',')[0].trim();
  const parts = a.split(/\s+/);
  return parts[parts.length - 1];
}

/** Le nom de l'auteur apparaît-il dans le texte de la notice ? */
export function authorAppears(author, haystack) {
  const name = stripAccents(lastName(author).toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  if (name.length < 3) return false;
  const text = stripAccents(String(haystack ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ');
  return text.includes(name);
}
