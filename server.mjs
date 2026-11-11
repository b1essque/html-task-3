import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { profiles, resourceDelay } from './fixture/profiles.mjs';
import { getNews } from './fixture/news.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => Object.hasOwn(values, key) ? escapeHTML(values[key]) : match);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const scenario = url.searchParams.get('scenario') || 'normal';
      if (!Object.hasOwn(profiles, scenario)) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Unknown scenario. Use normal, slow, race or reverse.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end();
      }
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const [document, card] = await Promise.all([
          readFile(path.join(publicRoot, 'index.html'), 'utf8'),
          readFile(path.join(publicRoot, 'card.html'), 'utf8'),
        ]);
        const cards = getNews().map(item => fill(card, item)).join('\n');
        const html = fill(document, { scenario }).replace('{{cards}}', cards);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Fixture-Scenario': scenario });
        return res.end(req.method === 'HEAD' ? undefined : html);
      }

      const pathname = decodeURIComponent(url.pathname);
      const filename = path.resolve(publicRoot, `.${pathname}`);
      if (!filename.startsWith(`${publicRoot}${path.sep}`)) {
        res.writeHead(403);
        return res.end();
      }
      let body;
      try { body = await readFile(filename); }
      catch (error) {
        if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Not found');
        }
        throw error;
      }
      if (pathname.endsWith('.css')) body = Buffer.from(fill(body.toString('utf8'), { scenario }));
      const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
      const delay = resourceDelay(pathname, scenario);
      // Задержки заданы сервером, а не случайными таймерами в клиентском коде.
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (res.destroyed) return;
      const headers = {
        'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=300',
        ETag: etag,
        'Timing-Allow-Origin': '*',
        'X-Fixture-Delay': String(delay),
        'X-Fixture-Scenario': scenario,
      };
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        return res.end();
      }
      res.writeHead(200, { ...headers, 'Content-Length': body.byteLength });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end('Fixture server error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Choose another PORT.` : error);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Учебный сайт: http://127.0.0.1:${port}/?scenario=normal`);
    console.log('Режимы: normal, slow, race, reverse. Остановка: Ctrl+C.');
  });
}
