// Réseaux de bibliothèques pris en charge.
// Chaque entrée indique le logiciel de catalogue (« connector ») et ses paramètres.

/** Réseau Syracuse sans réglage particulier. `scenario` : code « SC= » de la recherche avancée du portail,
 *  CATALOGUE quand le portail le propose (catalogue seul), sinon DEFAULT (tout le portail). */
function syracuse(id, city, name, base, { scenario = 'DEFAULT', portal = 'Default', short = city } = {}) {
  return { id, name, short, city, connector: 'syracuse', base, portal, scenario };
}

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

  // Autres réseaux sous Syracuse, par ordre alphabétique.
  syracuse('agen', 'Agen', 'Médiathèque Lacépède', 'https://www.agen-mediatheque.fr', { scenario: 'CATALOGUE' }),
  syracuse('ajaccio', 'Ajaccio', 'Bibliothèques et médiathèques d’Ajaccio', 'https://bibliotheque.ajaccio.fr'),
  syracuse('arles', 'Arles', 'Médiathèques d’Arles', 'https://mediatheque.ville-arles.fr'),
  syracuse('arlysere', 'Arlysère', 'Médiathèques du réseau Arlysère (Albertville)', 'https://mediatheques.arlysere.fr'),
  syracuse('aubagne', 'Aubagne', 'Médiathèque Marcel-Pagnol', 'https://mediatheque.aubagne.fr'),
  syracuse('aulnay-sous-bois', 'Aulnay-sous-Bois', 'Réseau des bibliothèques d’Aulnay-sous-Bois', 'https://reseaudesbibliotheques.aulnay-sous-bois.fr'),
  syracuse('avion', 'Avion', 'Médiathèque d’Avion', 'https://www.mediatheque-avion.fr'),
  syracuse('biarritz', 'Biarritz', 'Médiathèque de Biarritz', 'https://www.mediatheque-biarritz.fr'),
  syracuse('boulogne-billancourt', 'Boulogne-Billancourt', 'Médiathèques de Boulogne-Billancourt', 'https://mediatheques.boulognebillancourt.com'),
  syracuse('bourges', 'Bourges', 'Bibliothèques de Bourges', 'https://mediatheque.ville-bourges.fr'),
  syracuse('bruay-la-buissiere', 'Bruay-la-Buissière', 'Médiathèque de Bruay-la-Buissière', 'https://mediatheque.bruaylabuissiere.fr'),
  syracuse('bry-sur-marne', 'Bry-sur-Marne', 'Médiathèque Jules-Verne', 'https://mediatheque.brysurmarne.fr'),
  syracuse('cagnes-sur-mer', 'Cagnes-sur-Mer', 'Médiathèque de Cagnes-sur-Mer', 'https://mediatheque.cagnes.fr'),
  syracuse('capi', 'Porte de l’Isère', 'Médiathèques de la CAPI (Bourgoin-Jallieu…)', 'https://portail-mediatheque.capi-agglo.fr', { short: 'CAPI' }),
  syracuse('cesson-sevigne', 'Cesson-Sévigné', 'Médiathèque de Cesson-Sévigné', 'https://www.mediatheque-cesson-sevigne.fr'),
  syracuse('cholet', 'Cholet', 'Médiathèque et bibliothèques du Choletais', 'https://e-changes.cholet.fr'),
  syracuse('coueron', 'Couëron', 'Médiathèque de Couëron', 'https://mediatheque.ville-coueron.fr'),
  syracuse('deville-les-rouen', 'Déville-lès-Rouen', 'Médiathèque Anne-Frank', 'https://mediatheque-anne-frank.fr'),
  syracuse('dijon', 'Dijon', 'Bibliothèque municipale de Dijon', 'https://bm.dijon.fr', { scenario: 'CATALOGUE' }),
  syracuse('domitienne', 'La Domitienne', 'Médiathèques en Domitienne (Hérault)', 'https://mediatheques.ladomitienne.com'),
  syracuse('douarnenez', 'Douarnenez', 'Médiathèque Georges-Perros', 'https://mediatheque-douarnenez.fr', { scenario: 'CATALOGUE' }),
  syracuse('dugny', 'Dugny', 'Médiathèque de Dugny', 'https://dugny.syracuse.cloud', { portal: 'PORTAIL' }),
  // Catalogue commun aux quatre villes, publié en HTTP.
  syracuse('sitpi', 'Échirolles, Fontaine, Pont-de-Claix, Saint-Martin-d’Hères', 'Médiathèques du SITPI', 'http://syracuse.sitpi.fr', { short: 'SITPI' }),
  syracuse('evreux', 'Évreux', 'Médiathèques d’Évreux', 'https://mediatheques.evreux.fr'),
  syracuse('fontainebleau', 'Fontainebleau', 'Médiathèque de Fontainebleau', 'https://mediatheque.fontainebleau.fr'),
  syracuse('fougeres', 'Fougères Agglomération', 'Médiathèques de Fougères Agglomération', 'https://mediatheques.fougeres-agglo.bzh', { short: 'Fougères' }),
  syracuse('grand-narbonne', 'Grand Narbonne', 'Médiathèques du Grand Narbonne', 'https://mediatheques.legrandnarbonne.com'),
  syracuse('grand-orly-seine-bievre', 'Grand-Orly Seine Bièvre', 'Médiathèques et ludothèques de Grand-Orly Seine Bièvre', 'https://www.mediathequesludotheques.grandorlyseinebievre.fr'),
  // Portail servi sous /EXPLOITATION.
  syracuse('grand-poitiers', 'Grand Poitiers', 'Médiathèques de Grand Poitiers', 'https://www.mediatheques-grandpoitiers.fr/EXPLOITATION', { scenario: 'CATALOGUE', short: 'Poitiers' }),
  syracuse('henin-carvin', 'Hénin-Carvin', 'Réseau communautaire des médiathèques d’Hénin-Carvin', 'https://www.mediatheques-rcm.fr', { scenario: 'CATALOGUE' }),
  syracuse('issoudun', 'Issoudun', 'Médiathèque d’Issoudun', 'https://www.mediatheque.issoudun.fr'),
  syracuse('la-fleche', 'La Flèche', 'Bibliothèque intercommunale du Pays fléchois', 'https://www.bibliothequemunicipaledelafleche.fr'),
  syracuse('la-rochelle', 'La Rochelle', 'Médiathèques de l’agglomération de La Rochelle', 'https://mediatheques.agglo-larochelle.fr', { scenario: 'CATALOGUE' }),
  syracuse('le-port', 'Le Port (La Réunion)', 'Médiathèques du Port', 'https://mediatheque.ville-port.re', { short: 'Le Port' }),
  syracuse('le-tampon', 'Le Tampon (La Réunion)', 'Médiathèques du Tampon', 'https://www.mediatheque-tampon.fr', { short: 'Le Tampon' }),
  syracuse('lormont', 'Lormont', 'Médiathèque du Bois-Fleuri', 'https://mediatheque.lormont.fr'),
  syracuse('macon', 'Mâcon', 'Médiathèque de Mâcon', 'https://mediatheque.macon.fr'),
  syracuse('malakoff', 'Malakoff', 'Médiathèque de Malakoff', 'https://mediatheque.malakoff.fr'),
  syracuse('marcq-en-baroeul', 'Marcq-en-Barœul', 'Médiathèque La Corderie', 'https://corderie.marcq-en-baroeul.fr'),
  syracuse('massy', 'Massy', 'Médiathèques de Massy', 'https://mediatheque.ville-massy.fr'),
  syracuse('merignac', 'Mérignac', 'Médiathèques de Mérignac', 'https://www.mediatheque.merignac.com'),
  syracuse('muret', 'Muret', 'Médiathèque de Muret', 'https://mediatheque.mairie-muret.fr', { scenario: 'CATALOGUE' }),
  syracuse('reims', 'Reims', 'Bibliothèques de Reims', 'https://www.bm-reims.fr'),
  syracuse('rochefort-ocean', 'Rochefort Océan', 'Réseau M, médiathèques de Rochefort Océan', 'https://www.reseau-m.fr', { short: 'Rochefort' }),
  syracuse('rumilly', 'Rumilly', 'Médiathèque de Rumilly', 'https://www.mediatheque-rumilly74.fr'),
  syracuse('saint-etienne', 'Saint-Étienne', 'Médiathèques de Saint-Étienne', 'https://mediatheques.saint-etienne.fr', { scenario: 'CATALOGUE' }),
  syracuse('saint-lo', 'Saint-Lô', 'Médiathèques de Saint-Lô', 'https://smwe-mdsl.syracuse.cloud'),
  syracuse('saint-louis', 'Saint-Louis (Haut-Rhin)', 'Médiathèque Le Parnasse', 'https://mediatheque-saint-louis.syracuse.cloud', { short: 'Saint-Louis' }),
  syracuse('sceaux', 'Sceaux', 'Médiathèque de Sceaux', 'https://bibliotheque.sceaux.fr'),
  syracuse('toulon', 'Toulon', 'Réseau des bibliothèques de Toulon', 'https://mediatheques.toulon.fr'),
  syracuse('vevey', 'Vevey (Suisse)', 'Bibliothèque municipale de Vevey', 'https://biblio.vevey.ch', { short: 'Vevey' }),
  syracuse('villemomble', 'Villemomble', 'Médiathèque de Villemomble', 'https://mediatheque.villemomble.fr'),
  syracuse('villenave-d-ornon', 'Villenave-d’Ornon', 'Médiathèques de Villenave-d’Ornon', 'https://mediatheques.villenavedornon.fr'),
  syracuse('villeurbanne', 'Villeurbanne', 'Médiathèques de Villeurbanne', 'https://cataloguebm.villeurbanne.fr', { scenario: 'CATALOGUE' }),
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
