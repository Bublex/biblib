// Génère les visuels de la fiche Chrome Web Store dans store/ :
//   - 5 captures 1280×800 (store/captures/), la vignette 440×280, la bannière 1400×560.
// Le vrai panneau est capturé en action sur de vraies fiches de livres (mode clair),
// puis mis en page avec un titre, et rendu par Chrome.
//
// Usage : CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/store-assets.mjs
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './chrome.mjs';

const STORE = fileURLToPath(new URL('../store/', import.meta.url));
const SHOTS = join(STORE, 'captures');
const TMP = join(tmpdir(), `biblib-store-${Date.now()}`);
const ICON = fileURLToPath(new URL('../extension/icons/icon128.png', import.meta.url));
const LIBS = ['bordeaux', 'lyon', 'toulouse', 'marseille'];
const WAIT = Number(process.env.STORE_WAIT || 16000);
mkdirSync(SHOTS, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Copie de l'extension avec un Shadow DOM ouvert, pour mesurer et ouvrir le panneau.
const chrome = await launch({
  width: 1280,
  height: 800,
  patch: (dir) => {
    const file = join(dir, 'content/ui.js');
    writeFileSync(file, readFileSync(file, 'utf8').replace("attachShadow({ mode: 'closed' })", "attachShadow({ mode: 'open' })"));
  },
});

const rectOf = (session, expr) => chrome.evaluate(session, `(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
const shadow = "document.querySelector('[data-biblib]').shadowRoot";

async function capturePanel(url, name) {
  const page = await chrome.openPage(url, { scale: 2, colorScheme: 'light' });
  await sleep(WAIT);
  await chrome.hideOverlays(page);
  await chrome.evaluate(page, `${shadow}.querySelector('.pill').click()`);
  await sleep(700);
  await chrome.screenshot(page, join(TMP, `${name}-page.png`));
  const card = await rectOf(page, `${shadow}.querySelector('.card')`);
  await chrome.screenshot(page, join(TMP, `${name}-panel.png`), card);
  return { card };
}

try {
  console.log(chrome.product);
  const options = await chrome.openPage(`chrome-extension://${chrome.extId}/options/options.html`, { scale: 2, colorScheme: 'light' });
  await sleep(1000);
  await chrome.evaluate(options, `chrome.storage.local.set({ enabledLibraries: ${JSON.stringify(LIBS)} })`);
  await sleep(1500);
  const libs = await rectOf(options, "document.getElementById('libs').closest('.panel')");
  await chrome.screenshot(options, join(TMP, 'options.png'), { ...libs, height: Math.min(libs.height, 560) });

  await capturePanel('https://www.babelio.com/livres/Damasio-La-Horde-du-Contrevent/5420', 'babelio');
  await capturePanel('https://www.amazon.fr/dp/2070584623', 'amazon');

  const popup = await chrome.openPage(`chrome-extension://${chrome.extId}/popup/popup.html`, { scale: 2, colorScheme: 'light', w: 380, h: 600 });
  await sleep(1000);
  await chrome.evaluate(popup, "document.getElementById('query').value = '9782070612758'; document.getElementById('searchForm').requestSubmit()");
  await sleep(WAIT);
  await chrome.screenshot(popup, join(TMP, 'popup.png'));

  // --- Mise en page ---
  const img = (name) => pathToFileURL(join(TMP, name)).href;
  const icon = pathToFileURL(ICON).href;
  const base = `
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 100%; height: 100%; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d1d1f; background: #f6f5f1; overflow: hidden; }
    .slide { position: relative; width: 1280px; height: 800px; display: flex; align-items: center; gap: 56px; padding: 0 72px; }
    .slide::before { content: ""; position: absolute; right: -180px; top: -160px; width: 760px; height: 760px; border-radius: 50%; background: #e3e9f5; }
    .text { position: relative; flex: 0 0 470px; }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 700; color: #284b8f; margin-bottom: 28px; }
    .brand img { width: 40px; height: 40px; }
    h1 { font-size: 46px; line-height: 1.1; letter-spacing: -0.02em; }
    p { margin-top: 20px; font-size: 21px; line-height: 1.45; color: #55555c; }
    ul { list-style: none; padding: 0; margin-top: 26px; display: grid; gap: 14px; }
    li { position: relative; padding-left: 34px; font-size: 19px; line-height: 1.4; color: #3a3a40; }
    li::before { content: ""; position: absolute; left: 0; top: 3px; width: 22px; height: 22px; border-radius: 50%; background: #e5f3eb url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231f7a4d' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 12.5l4 4 8-9'/%3E%3C/svg%3E") center / 14px no-repeat; }
    .visual { position: relative; flex: 1; display: flex; justify-content: center; align-items: center; height: 100%; }
    .shot { display: block; border-radius: 14px; box-shadow: 0 24px 60px rgba(30, 40, 70, .22), 0 4px 14px rgba(30, 40, 70, .1); }
  `;
  const slide = (headline, body, visual) => `<!doctype html><meta charset="utf-8"><style>${base}</style>
    <div class="slide"><div class="text"><div class="brand"><img src="${icon}" alt="">Biblib</div><h1>${headline}</h1>${body}</div><div class="visual">${visual}</div></div>`;
  const panel = (name, width = 380, maxHeight = 640) => `<img class="shot" src="${img(`${name}-panel.png`)}" style="width:${width}px; max-height:${maxHeight}px; object-fit: cover; object-position: top">`;

  const slides = [
    slide('Ce livre est-il à la bibliothèque&nbsp;?',
      '<p>Biblib répond sur la fiche du livre, sans quitter la page&nbsp;: Amazon, Babelio, Bedetheque, Fnac, Decitre, Mollat…</p>',
      // Partie droite de la page (fiche + panneau), à taille lisible.
      `<div class="shot" style="width: 660px; height: 560px; overflow: hidden; position: relative; background: #fff">
        <img src="${img('babelio-page.png')}" style="position: absolute; right: 0; bottom: 0; width: 1100px"></div>`),
    slide('Disponible, emprunté, date de retour',
      '<p>Annexe par annexe, avec la cote et le rayon. Un clic ouvre la notice du catalogue pour réserver.</p>',
      panel('amazon')),
    slide('Une autre édition&nbsp;? Trouvée aussi',
      '<p>Recherche par ISBN, toutes éditions connues confondues, puis par titre et auteur. Les autres éditions sont clairement signalées.</p>',
      panel('babelio')),
    slide('13 grands réseaux de bibliothèques',
      '<p>Paris, Bordeaux et sa métropole, Lyon, Marseille, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Lille, Rennes, Grenoble.</p><p>Une étoile sur votre annexe&nbsp;: elle passe en premier.</p>',
      `<img class="shot" src="${img('options.png')}" style="width: 600px">`),
    slide('Vos données restent sur votre appareil',
      `<ul><li>Aucun compte, aucun serveur Biblib, aucune statistique</li>
        <li>Seuls l’ISBN, le titre et l’auteur partent, vers vos bibliothèques uniquement</li>
        <li>Réservation sur le site de la bibliothèque, avec votre compte lecteur</li></ul>`,
      `<img class="shot" src="${img('popup.png')}" style="width: 380px">`),
  ];

  const promo = `<!doctype html><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    body { width: 440px; height: 280px; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #284b8f, #1c3466); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 0 36px; position: relative; }
    body::after { content: ""; position: absolute; right: -60px; bottom: -80px; width: 240px; height: 240px; border-radius: 50%; background: rgba(255,255,255,.07); }
    .row { display: flex; align-items: center; gap: 16px; }
    .tile { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 16px; background: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
    img { width: 64px; height: 64px; }
    h1 { font-size: 40px; letter-spacing: -0.02em; }
    p { margin-top: 18px; font-size: 21px; line-height: 1.3; font-weight: 600; }
    small { display: block; margin-top: 10px; font-size: 14px; opacity: .8; }
  </style><div class="row"><span class="tile"><img src="${icon}" alt=""></span><h1>Biblib</h1></div>
  <p>Ce livre est-il dans ma bibliothèque&nbsp;?</p><small>Disponibilité et réservation, sur la fiche du livre</small>`;

  const marquee = `<!doctype html><meta charset="utf-8"><style>${base}
    .slide { width: 1400px; height: 560px; background: linear-gradient(135deg, #284b8f, #1c3466); color: #fff; }
    .slide::before { background: rgba(255,255,255,.06); }
    .brand { color: #fff; } h1 { font-size: 50px; } p { color: rgba(255,255,255,.85); }
    .visual { align-items: flex-start; padding-top: 48px; }
  </style><div class="slide"><div class="text" style="flex-basis: 600px"><div class="brand"><img src="${icon}" alt="">Biblib</div>
  <h1>Ce livre est-il dans ma bibliothèque&nbsp;?</h1><p>La réponse sur Amazon, Babelio, Bedetheque… et la réservation en un clic.</p></div>
  <div class="visual">${panel('amazon', 420, 900)}</div></div>`;

  const render = async (html, file, w, h) => {
    const htmlFile = join(TMP, `${file.replace(/\W+/g, '-')}.html`);
    writeFileSync(htmlFile, html);
    const page = await chrome.openPage(pathToFileURL(htmlFile).href, { w, h, colorScheme: 'light' });
    await sleep(1200);
    await chrome.screenshot(page, join(STORE, file));
    console.log(`store/${file}`);
  };
  for (const [i, html] of slides.entries()) await render(html, `captures/${i + 1}.png`, 1280, 800);
  await render(promo, 'vignette-440x280.png', 440, 280);
  await render(marquee, 'banniere-1400x560.png', 1400, 560);
} finally {
  await chrome.close();
  rmSync(TMP, { recursive: true, force: true });
}
