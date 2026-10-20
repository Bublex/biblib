// Test de bout en bout : charge l'extension dans Chrome (profil temporaire, headless),
// active des bibliothèques, ouvre de vraies fiches de livres et enregistre des captures d'écran.
//
// Usage :
//   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/e2e.mjs [dossier-de-sortie]
//   E2E_LIBS="paris bordeaux lyon"  E2E_PAGES="https://… https://…"  E2E_WAIT=16000
//
// Utilisez une version récente de Chrome : certains catalogues (Bordeaux) coupent la connexion
// aux navigateurs dont l'empreinte réseau ne correspond pas à un Chrome à jour.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launch, sleep } from './chrome.mjs';

const OUT = resolve(process.argv[2] || join(tmpdir(), 'biblib-e2e'));
const WIDTH = 1400;
const HEIGHT = 950;
const PAGES = (process.env.E2E_PAGES || [
  'https://www.babelio.com/livres/Damasio-La-Horde-du-Contrevent/5420',
  'https://www.amazon.fr/dp/2070584623',
  'https://www.bedetheque.com/BD-Blacksad-Tome-1-Quelque-part-entre-les-ombres-15161.html',
].join(' ')).split(' ');
const LIBS = (process.env.E2E_LIBS || 'paris bordeaux lyon marseille toulouse nantes').split(' ');

mkdirSync(OUT, { recursive: true });
const chrome = await launch({ width: WIDTH, height: HEIGHT });
try {
  console.log(`${chrome.product} — extension ${chrome.extId}`);

  // Journal du service worker (avertissements des connecteurs).
  let sw;
  for (let i = 0; i < 50 && !sw; i++) {
    sw = (await chrome.cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'service_worker' && t.url.includes(chrome.extId));
    if (!sw) await sleep(200);
  }
  const { sessionId: swSession } = await chrome.cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true });
  await chrome.cdp.send('Runtime.enable', {}, swSession);
  chrome.cdp.on((msg) => {
    if (msg.sessionId === swSession && msg.method === 'Runtime.consoleAPICalled') {
      console.log('  [service worker]', msg.params.args.map((a) => a.value ?? a.description?.split('\n')[0]).join(' '));
    }
  });

  const options = await chrome.openPage(`chrome-extension://${chrome.extId}/options/options.html`);
  await sleep(1500);
  await chrome.evaluate(options, `chrome.storage.local.set({ enabledLibraries: ${JSON.stringify(LIBS)} })`);
  await sleep(1500);
  await chrome.screenshot(options, join(OUT, '00-reglages.png'));

  let n = 1;
  for (const url of PAGES) {
    console.log(`\n${url}`);
    const page = await chrome.openPage(url);
    await sleep(Number(process.env.E2E_WAIT || 16000));
    const prefix = String(n++).padStart(2, '0');
    console.log('  titre :', await chrome.evaluate(page, 'document.title'));
    console.log('  pastille :', await chrome.evaluate(page, 'Boolean(document.querySelector("[data-biblib]"))'));
    await chrome.hideOverlays(page);
    await chrome.screenshot(page, join(OUT, `${prefix}-pastille.png`));
    // La pastille est en bas à droite (20 px de marge).
    await chrome.click(page, WIDTH - 60, HEIGHT - 42);
    await sleep(800);
    await chrome.screenshot(page, join(OUT, `${prefix}-panneau.png`));
    console.log('  captures :', join(OUT, `${prefix}-*.png`));
  }
} finally {
  await chrome.close();
}
