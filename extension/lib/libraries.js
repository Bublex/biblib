// Réseaux de bibliothèques pris en charge.
// Chaque entrée indique le logiciel de catalogue (« connector ») et ses paramètres.

export const LIBRARIES = [
  {
    id: 'paris',
    name: 'Bibliothèques de la Ville de Paris',
    short: 'Paris',
    city: 'Paris',
    connector: 'syracuse',
    base: 'https://bibliotheques.paris.fr',
    portal: 'Default',
    scenario: 'CATALOGUE',
  },
  {
    id: 'bordeaux',
    name: 'Bibliothèques de Bordeaux',
    short: 'Bordeaux',
    city: 'Bordeaux',
    connector: 'inmedia',
    base: 'https://bibliotheque.bordeaux.fr',
    sf: '+TypeOfDocumentFacet:BordeauxMetropolePhysicalDocument',
    isbnSyntax: 'plain',
    // Le catalogue est commun à la métropole : on ne garde que les exemplaires de la ville.
    branchFilter: { field: 'parentBranch_desc', values: ['Commune de Bordeaux'] },
  },
  {
    id: 'bordeaux-metropole',
    name: 'Bordeaux Métropole (toutes les communes)',
    short: 'Bordeaux Métropole',
    city: 'Bordeaux Métropole',
    connector: 'inmedia',
    base: 'https://bibliotheque.bordeaux.fr',
    sf: '+TypeOfDocumentFacet:BordeauxMetropolePhysicalDocument',
    isbnSyntax: 'plain',
    showGroups: true,
  },
  {
    id: 'merignac',
    name: 'Médiathèques de Mérignac',
    short: 'Mérignac',
    city: 'Mérignac',
    connector: 'syracuse',
    // Catalogue propre à la ville, distinct du catalogue commun de Bordeaux Métropole.
    base: 'https://www.mediatheque.merignac.com',
    portal: 'Default',
    scenario: 'DEFAULT',
  },
  {
    id: 'lyon',
    name: 'Bibliothèque municipale de Lyon',
    short: 'Lyon',
    city: 'Lyon',
    connector: 'inmedia',
    base: 'https://catalogue.bm-lyon.fr',
    isbnSyntax: 'prefixed',
  },
  {
    id: 'marseille',
    name: 'Bibliothèques de Marseille',
    short: 'Marseille',
    city: 'Marseille',
    connector: 'inmedia',
    base: 'https://www.bmvr.marseille.fr',
    isbnSyntax: 'plain',
  },
  {
    id: 'toulouse',
    name: 'Bibliothèques de Toulouse',
    short: 'Toulouse',
    city: 'Toulouse',
    connector: 'web2',
    // Le catalogue Rosalis n'est servi qu'en HTTP.
    base: 'http://catalogues.toulouse.fr',
    settingKey: 'BMT1',
    charset: 'windows-1252',
  },
  {
    id: 'nice',
    name: 'Bibliothèques de Nice',
    short: 'Nice',
    city: 'Nice',
    connector: 'syracuse',
    base: 'https://bmvr.nice.fr',
    portal: 'Default',
    scenario: 'CATALOGUE',
  },
  {
    id: 'nantes',
    name: 'Bibliothèque municipale de Nantes',
    short: 'Nantes',
    city: 'Nantes',
    connector: 'inmedia',
    base: 'https://catalogue-bibliotheque.nantes.fr',
    isbnSyntax: 'plain',
  },
  {
    id: 'montpellier',
    name: 'Médiathèques de Montpellier Méditerranée Métropole',
    short: 'Montpellier',
    city: 'Montpellier',
    connector: 'syracuse',
    base: 'https://mediatheques.montpellier3m.fr',
    portal: 'Default',
    scenario: 'DEFAULT',
  },
  {
    id: 'strasbourg',
    name: 'Médiathèques de Strasbourg Eurométropole',
    short: 'Strasbourg',
    city: 'Strasbourg',
    connector: 'syracuse',
    base: 'https://www.mediatheques.strasbourg.eu',
    portal: 'Default',
    scenario: 'CATALOGUE',
  },
  {
    id: 'lille',
    name: 'Bibliothèque municipale de Lille',
    short: 'Lille',
    city: 'Lille',
    connector: 'syracuse',
    base: 'https://bm-lille.fr',
    portal: 'bml',
    scenario: 'CATALOGUE',
  },
  {
    id: 'rennes',
    name: 'Bibliothèques de Rennes et Champs Libres',
    short: 'Rennes',
    city: 'Rennes',
    connector: 'encore',
    base: 'https://opac.si.leschampslibres.fr',
    // Sans session, le catalogue redirige d'abord vers son serveur d'authentification (CAS).
    extraOrigins: ['https://sbib.si.leschampslibres.fr/*'],
  },
  {
    id: 'grenoble',
    name: 'Bibliothèque municipale de Grenoble',
    short: 'Grenoble',
    city: 'Grenoble',
    connector: 'syracuse',
    base: 'https://bm-grenoble.fr',
    portal: 'Default',
    scenario: 'CATALOGUE',
  },
];

export function getLibrary(id) {
  return LIBRARIES.find((lib) => lib.id === id) || null;
}

/** Autorisations d'hôte (« host permissions ») nécessaires pour interroger ce catalogue. */
export function originPatterns(lib) {
  return [`${new URL(lib.base).origin}/*`, ...(lib.extraOrigins || [])];
}

/** Informations utiles à l'interface (sans les paramètres techniques). */
export function libraryMeta(lib) {
  return { id: lib.id, name: lib.name, short: lib.short, city: lib.city, showGroups: Boolean(lib.showGroups) };
}
