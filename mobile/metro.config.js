// L'app réutilise le code de l'extension (connecteurs des catalogues, résumé de disponibilité) :
// Metro doit surveiller et compiler ../extension, hors du dossier du projet.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../extension')];

module.exports = config;
