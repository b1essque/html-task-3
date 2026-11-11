import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { getNews } from '../fixture/news.mjs';
import { profiles, resourceDelay } from '../fixture/profiles.mjs';

let server;
let base;
before(async () => {
  server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('Данные содержат 1000 новостей с уникальными идентификаторами', () => {
  const news = getNews();
  assert.equal(news.length, 1000);
  assert.equal(new Set(news.map(item => item.id)).size, 1000);
  assert.deepEqual(getNews(), news);
});

test('HTML содержит все карточки и подставляет выбранный сценарий', async () => {
  const response = await fetch(`${base}/?scenario=slow`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((html.match(/data-news-id=/g) || []).length, 1000);
  assert.ok(html.includes('scenario=slow'));
  assert.ok(!html.includes('{{'));
});

test('Задержки ресурсов зависят от сценария', () => {
  assert.equal(resourceDelay('/js/analytics.js', 'slow'), 8000);
  assert.ok(profiles.race.tools > profiles.race.app);
  assert.ok(profiles.reverse.tools < profiles.reverse.app);
});

test('CSS передаёт сценарий запросу шрифта', async () => {
  const response = await fetch(`${base}/css/site.css?scenario=reverse`);
  assert.match(response.headers.get('content-type'), /^text\/css/);
  assert.equal(response.headers.get('x-fixture-delay'), '100');
  assert.ok((await response.text()).includes('PTSerif-Regular.ttf?scenario=reverse'));
});

test('Статические файлы кешируются и поддерживают ETag', async () => {
  const response = await fetch(`${base}/js/tools.js?scenario=normal`);
  const etag = response.headers.get('etag');
  assert.equal(response.status, 200);
  assert.ok(etag);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
  assert.ok((await response.text()).includes('NewsTools'));
  const cached = await fetch(`${base}/js/tools.js?scenario=normal`, { headers: { 'If-None-Match': etag } });
  assert.equal(cached.status, 304);
});

test('Неизвестные маршруты и сценарии не подменяются HTML', async () => {
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/?scenario=unknown`)).status, 400);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
});

test('Шрифт и иллюстрация доступны локально', async () => {
  const font = await fetch(`${base}/assets/PTSerif-Regular.ttf`);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/ttf');
  assert.ok((await font.arrayBuffer()).byteLength > 10000);
  const image = await fetch(`${base}/assets/campus.svg`);
  assert.equal(image.status, 200);
  assert.match(await image.text(), /viewBox="0 0 1200 360"/);
});
