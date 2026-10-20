import syracuse from './syracuse.js';
import inmedia from './inmedia.js';
import web2 from './web2.js';
import encore from './encore.js';

const CONNECTORS = { syracuse, inmedia, web2, encore };

export function getConnector(id) {
  const connector = CONNECTORS[id];
  if (!connector) throw new Error(`Connecteur inconnu : ${id}`);
  return connector;
}
