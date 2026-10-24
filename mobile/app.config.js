// Complète app.json : iOS refuse par défaut les adresses en HTTP (App Transport Security).
// Les catalogues encore servis en HTTP (Toulouse, SITPI…) sont lus dans le registre des bibliothèques,
// pour qu'une bibliothèque ajoutée à l'extension soit aussi joignable depuis l'app.
const fs = require('node:fs');
const path = require('node:path');

const registry = fs.readFileSync(path.join(__dirname, '../extension/lib/libraries.js'), 'utf8');
const httpHosts = [...new Set([...registry.matchAll(/'http:\/\/([^/']+)'/g)].map((m) => m[1]))];

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      NSAppTransportSecurity: {
        NSExceptionDomains: Object.fromEntries(httpHosts.map((host) => [host, { NSExceptionAllowsInsecureHTTPLoads: true }])),
      },
    },
  },
});
