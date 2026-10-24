// Raccourci « scanner un livre » sur téléphone : l'adresse de recherche du catalogue, où le code-barres
// scanné (l'ISBN) prend la place de {RESULT}. C'est la syntaxe des actions automatiques de Binary Eye
// (Android) ; dans Raccourcis (iPhone), on remplace {RESULT} par la variable du scan.

import { getConnector } from './connectors/index.js';

export const PLACEHOLDER = '{RESULT}';
// Repère sans caractère à encoder : l'URL produite par le connecteur le contient tel quel.
const MARK = 'BIBLIBISBN';

/** Modèle d'adresse pour ce réseau, ou null si son catalogue n'a pas d'URL de recherche publique (inMedia). */
export function phoneTemplate(lib) {
  const url = getConnector(lib.connector).searchUrl(lib, MARK);
  return url.includes(MARK) ? url.replace(MARK, PLACEHOLDER) : null;
}
