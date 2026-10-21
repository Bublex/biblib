// Génère la vidéo de présentation du Chrome Web Store : store/biblib-presentation.mp4 (1920×1080, 30 i/s, sans son).
// La vraie interface (page de réglages, pastille, panneau) est animée par tools/video/stage.html,
// rendue image par image par Chrome, puis encodée par ffmpeg (à installer).
//
// Usage : CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/store-video.mjs
// Aperçu (quelques images PNG, sans encodage) : VIDEO_PREVIEW="3 7.5 13 15.5" node tools/store-video.mjs [dossier]
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'store', 'biblib-presentation.mp4');
const FPS = 30;
const PREVIEW = process.env.VIDEO_PREVIEW?.split(/\s+/).filter(Boolean).map(Number);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// La vraie page de réglages, branchée sur une API chrome.* simulée.
function settingsPage() {
  return readFileSync(join(ROOT, 'extension/options/options.html'), 'utf8')
    .replace('href="options.css"', 'href="/extension/options/options.css"')
    .replaceAll('../icons/', '/extension/icons/')
    .replace('<script type="module" src="options.js"></script>',
      '<script src="/tools/video/chrome-stub.js"></script>\n  <script type="module" src="/extension/options/options.js"></script>');
}

// Les pages de démonstration importent les modules de l'extension : il leur faut une origine HTTP.
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/reglages.html') {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(settingsPage());
    return;
  }
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

const frames = PREVIEW ? resolve(process.argv[2] || join(tmpdir(), 'biblib-video-apercu')) : join(tmpdir(), `biblib-video-${Date.now()}`);
mkdirSync(frames, { recursive: true });
const chrome = await launch({ width: 1280, height: 720 });
try {
  const page = await chrome.openPage(`http://127.0.0.1:${server.address().port}/tools/video/stage.html`, { w: 1280, h: 720, scale: 1.5, colorScheme: 'light' });
  for (let i = 0; i < 100 && !(await chrome.evaluate(page, 'typeof window.ready === "object"').catch(() => false)); i++) await sleep(100);
  // Onglet au premier plan, sinon requestAnimationFrame ne se déclenche pas et seek() ne rend jamais la main.
  // Rappelé tant que la page n'a pas répondu : à son installation, l'extension ouvre ses réglages dans un autre onglet.
  const run = async (expression) => {
    let done = false;
    const result = chrome.evaluate(page, expression).finally(() => { done = true; });
    while (!done) {
      await chrome.cdp.send('Page.bringToFront', {}, page);
      await Promise.race([result, sleep(1000)]);
    }
    return result;
  };
  await run('window.ready');
  const total = Math.round((await run('window.DURATION')) * FPS);
  const wanted = new Set(PREVIEW?.map((s) => Math.round(s * FPS)));

  for (let i = 0; i < total; i++) {
    await run(`seek(${i / FPS})`);
    if (PREVIEW && !wanted.has(i)) continue;
    await chrome.screenshot(page, join(frames, PREVIEW ? `${(i / FPS).toFixed(2)}s.png` : `${String(i).padStart(5, '0')}.png`));
    if (!PREVIEW && i % FPS === 0) process.stdout.write(`\r${i / FPS} / ${total / FPS} s`);
  }
  if (PREVIEW) {
    console.log(`Aperçu : ${frames}`);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT]);
    console.log(`\n${OUT}`);
  }
} finally {
  await chrome.close();
  server.close();
  if (!PREVIEW) rmSync(frames, { recursive: true, force: true });
}
