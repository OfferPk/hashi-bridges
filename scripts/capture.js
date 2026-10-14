const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const DOCS = path.join(ROOT, 'docs');
fs.mkdirSync(DOCS, { recursive: true });

async function serve(dir) {
  const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

(async () => {
  const { server, base } = await serve(WWW);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  async function rasterIcon(size, out) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.goto(`${base}/_icon.html`, { waitUntil: 'load', timeout: 15000 });
    await page.evaluate((s) => {
      const i = document.getElementById('i');
      i.width = s; i.height = s;
    }, size);
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: out });
    await page.close();
  }

  await rasterIcon(512, path.join(WWW, 'icon-512.png'));
  await rasterIcon(192, path.join(WWW, 'icon-192.png'));
  console.log('icons', fs.statSync(path.join(WWW,'icon-512.png')).size, fs.statSync(path.join(WWW,'icon-192.png')).size);

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(base + '/', { waitUntil: 'load', timeout: 20000 });
  await page.waitForSelector('#btn-continue');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(DOCS, 'screenshot-home.png') });
  console.log('home');

  await page.click('#btn-continue');
  await page.waitForSelector('#play.active');
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(DOCS, 'screenshot-playing.png') });
  console.log('playing');

  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => document.getElementById('modal-win').classList.contains('open'))) break;
    await page.click('#btn-hint');
    await new Promise((r) => setTimeout(r, 150));
  }
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(DOCS, 'screenshot-win.png') });
  console.log('win');

  if (await page.evaluate(() => document.getElementById('modal-win').classList.contains('open'))) {
    await page.click('#win-levels');
  } else {
    await page.click('#btn-levels2');
  }
  await page.waitForSelector('#levels.active');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(DOCS, 'screenshot-levels.png') });
  console.log('levels');

  await browser.close();
  server.close();
  try { fs.unlinkSync(path.join(WWW, '_icon.html')); } catch (_) {}
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
