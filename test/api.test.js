import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { loadContent, loadFilmMedia, loadFilmScripts, validateContent } from '../server/content.js';
import { openDatabase } from '../server/db.js';
import { validateFilms, validateShots } from '../server/film.js';
import { speechText } from '../server/speech.js';

const content = loadContent();
const filmScripts = loadFilmScripts(content);
const filmMedia = loadFilmMedia(content);
let server;
let base;

// Stands in for the neural voice: any registered text "plays" a fixed file.
function fakeNarrator() {
  const texts = new Map();
  return {
    available: true,
    voice: 'Тест',
    ext: 'mp3',
    contentType: 'audio/mpeg',
    timings: true,
    register(text) {
      const id = createHash('sha1').update(text).digest('hex').slice(0, 20);
      texts.set(id, text);
      return id;
    },
    has: (id) => texts.has(id),
    file: async () => fileURLToPath(new URL('../public/img/star.svg', import.meta.url)),
    timingsFile: async () => fileURLToPath(new URL('../package.json', import.meta.url)),
  };
}

before(async () => {
  const db = openDatabase(':memory:', content);
  const app = createApp({
    db,
    content,
    filmScripts,
    filmMedia,
    narrator: fakeNarrator(),
    commentLimit: { max: 3, windowMs: 60_000 },
  });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

const post = async (path, payload) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
};

test('content file is valid', () => {
  assert.ok(content.scholars.length >= 10);
  assert.throws(
    () => validateContent({ ...content, scholars: [...content.scholars, content.scholars[0]] }),
    /slug повторяется/,
  );
});

test('meta lists fields and eras with counts', async () => {
  const { status, body } = await get('/api/meta');
  assert.equal(status, 200);
  assert.equal(body.total, content.scholars.length);
  const medicine = body.fields.find((f) => f.id === 'medicine');
  assert.equal(medicine.count, content.scholars.filter((s) => s.fields.includes('medicine')).length);
});

test('list is chronological by default and returns summaries only', async () => {
  const { body } = await get('/api/scholars');
  assert.equal(body.count, content.scholars.length);
  const years = body.scholars.map((s) => s.bornYear);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  assert.equal(body.scholars[0].story, undefined);
});

test('search ignores case and ё, and every word must match', async () => {
  const biruni = await get(`/api/scholars?q=${encodeURIComponent('НАНДАНА')}`);
  assert.deepEqual(biruni.body.scholars.map((s) => s.slug), ['al-biruni']);

  const yo = await get(`/api/scholars?q=${encodeURIComponent('учёные')}`);
  const ye = await get(`/api/scholars?q=${encodeURIComponent('ученые')}`);
  assert.equal(yo.body.count, ye.body.count);

  const both = await get(`/api/scholars?q=${encodeURIComponent('самарканд π')}`);
  assert.deepEqual(both.body.scholars.map((s) => s.slug), ['al-kashi']);
});

test('filters by field and era, sorts by name', async () => {
  const med = await get('/api/scholars?field=medicine');
  assert.ok(med.body.scholars.every((s) => s.fields.includes('medicine')));

  const timurid = await get('/api/scholars?era=timurid');
  assert.deepEqual(timurid.body.scholars.map((s) => s.slug).sort(), ['al-kashi', 'ali-kushchi', 'ulugbek']);

  const byName = await get('/api/scholars?sort=name');
  const names = byName.body.scholars.map((s) => s.name);
  // «Аль-Бируни» sorts under «Б», before «Ибн Сина».
  assert.ok(names.indexOf('Аль-Бируни') < names.indexOf('Ибн Сина'));
});

test('rejects unknown filter values', async () => {
  assert.equal((await get('/api/scholars?field=alchemy')).status, 400);
  assert.equal((await get('/api/scholars?era=future')).status, 400);
  assert.equal((await get('/api/scholars?sort=random')).status, 400);
});

test('scholar detail has the story and chronological neighbours', async () => {
  const { status, body } = await get('/api/scholars/ibn-sina');
  assert.equal(status, 200);
  assert.equal(body.scholar.name, 'Ибн Сина');
  assert.ok(body.scholar.story.paragraphs.length > 0);
  assert.equal(body.prev.slug, 'al-biruni');
  assert.equal(body.next.slug, 'omar-khayyam');

  const first = await get('/api/scholars/al-khwarizmi');
  assert.equal(first.body.prev, null);

  assert.equal((await get('/api/scholars/nobody')).status, 404);
});

test('comments: validation, creation, listing, rate limit', async () => {
  const bad = await post('/api/scholars/al-biruni/comments', { author: 'A', body: '' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fields.author);
  assert.ok(bad.body.fields.body);

  assert.equal((await post('/api/scholars/al-biruni/comments', '{oops')).status, 400);
  assert.equal((await post('/api/scholars/nobody/comments', { author: 'Аня', body: 'Привет' })).status, 404);
  assert.equal(
    (await post('/api/scholars/al-biruni/comments', { author: 'Бот', body: 'спам спам', website: 'x.com' })).status,
    400,
  );

  const created = await post('/api/scholars/al-biruni/comments', {
    author: '  Камола\u0000  ',
    body: 'Как он измерил высоту горы?\n\n\n\nСпасибо!',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.comment.author, 'Камола');
  assert.equal(created.body.comment.body, 'Как он измерил высоту горы?\n\nСпасибо!');

  const list = await get('/api/scholars/al-biruni/comments');
  assert.equal(list.body.comments[0].author, 'Камола');

  const detail = await get('/api/scholars/al-biruni');
  assert.equal(detail.body.commentCount, 1);

  // Limit is 3 per window in this test app; one comment was already accepted.
  await post('/api/scholars/al-biruni/comments', { author: 'Тимур', body: 'Второй' });
  await post('/api/scholars/al-biruni/comments', { author: 'Тимур', body: 'Третий' });
  const limited = await post('/api/scholars/al-biruni/comments', { author: 'Тимур', body: 'Четвёртый' });
  assert.equal(limited.status, 429);
});

test('every scholar has a short film, and the scripts are checked', () => {
  for (const s of content.scholars) assert.ok(filmScripts[s.slug], `нет фильма для ${s.slug}`);
  const shots = filmMedia.shots;
  const bad = (beats) => () => validateFilms(content, { 'al-biruni': beats }, shots);
  assert.throws(bad([{ title: 'Часть', say: 'коротко' }]), /нет закадрового текста/);
  assert.throws(bad([{ title: 'Часть', say: 'Достаточно длинный закадровый текст.', photos: ['s9-9'] }]), /нет кадра «s9-9»/);
  assert.throws(bad([{ title: 'Часть', say: 'Достаточно длинный закадровый текст.', animate: true }]), /animate без сцены/);
  assert.throws(() => validateFilms(content, { nobody: [] }, shots), /нет такого учёного/);
});

test('a film is short: a hook, one or two discoveries in 3D, the legacy', async () => {
  const { status, body } = await get('/api/scholars/al-biruni/film');
  assert.equal(status, 200);
  assert.equal(body.scholar.name, 'Аль-Бируни');
  assert.equal(body.next.slug, 'ibn-sina');
  assert.equal(body.beats[0].kind, 'intro');
  assert.match(body.beats[0].text, /^Как измерить всю Землю/);
  assert.equal(body.beats.at(-1).kind, 'legacy');
  assert.ok(body.beats.length <= 6);
  const chars = body.beats.reduce((sum, b) => sum + b.text.length, 0);
  assert.ok(chars < 1400, `фильм слишком длинный: ${chars} знаков`);
  // No film tells the viewer to wait for the next episode.
  for (const b of body.beats) assert.doesNotMatch(b.text, /следующем фильме/);
  for (const b of body.beats) {
    assert.match(b.audio, /^\/api\/narration\/[a-f0-9]{20}\.mp3$/);
    assert.equal(b.timings, b.audio.replace('.mp3', '.json'));
  }
  assert.equal((await get('/api/scholars/nobody/film')).status, 404);
});

test('every film shows a discovery as a 3D animation', async () => {
  for (const s of content.scholars) {
    const { body } = await get(`/api/scholars/${s.slug}/film`);
    const animations = body.beats.flatMap((b) => b.shots.filter((shot) => shot.scene));
    assert.ok(animations.length >= 1, `нет анимации открытия у ${s.slug}`);
  }
  const { body } = await get('/api/scholars/al-biruni/film');
  const measure = body.beats.find((b) => b.scene === 'earth-measure');
  const animation = measure.shots.at(-1);
  assert.equal(animation.scene, 'earth-measure');
  assert.ok(animation.weight > 1);
  // «only»: the algebra part of al-Khwarizmi is all animation.
  const algebra = (await get('/api/scholars/al-khwarizmi/film')).body.beats.find((b) => b.scene === 'algebra');
  assert.deepEqual(algebra.shots.map((x) => x.scene), ['algebra']);
});

test('narration audio is served only for registered texts', async () => {
  const { body } = await get('/api/scholars/ulugbek/film');
  const res = await fetch(base + body.beats[1].audio);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  const timings = await fetch(base + body.beats[1].timings);
  assert.equal(timings.status, 200);
  assert.match(timings.headers.get('content-type'), /json/);

  assert.equal((await fetch(`${base}/api/narration/${'0'.repeat(20)}.mp3`)).status, 404);
  assert.equal((await fetch(base + body.beats[1].audio.replace('.mp3', '.m4a'))).status, 404);
  assert.equal((await fetch(`${base}/api/narration/../../server.mp3`)).status, 404);
});

test('speech text fixes words the voice misreads', () => {
  assert.equal(speechText('Мехмеду II Завоевателю'), 'Мехмеду Второму Завоевателю');
  assert.equal(speechText('число π'), 'число пи');
  assert.equal(speechText('«Dixit Algorizmi»'), '«Диксит Алгоризми»');
  assert.equal(speechText('В начале IX века'), 'В начале девятого века');
  assert.equal(speechText('в XII веке'), 'в двенадцатом веке');
  assert.equal(speechText('вплоть до XVII века'), 'вплоть до семнадцатого века');
  assert.equal(speechText('около 6340 км.'), 'около 6340 километров.');
  assert.equal(speechText('братья (см. аль-Фергани), помочь'), 'братья, помочь');
});

test('storyboard is checked at startup', () => {
  assert.ok(filmMedia.shots.scholars['al-biruni'].beats.portrait.length > 0);
  const bad = (beats) => ({ scholars: { 'al-biruni': { beats } } });
  assert.throws(() => validateShots(content, bad({ 'story:9': [{ p: 'a long enough prompt' }] })), /нет части/);
  assert.throws(() => validateShots(content, bad({ legacy: [{ p: 'a long enough prompt', m: 'zoom' }] })), /неизвестное движение/);
  assert.throws(() => validateShots(content, bad({ legacy: [{ p: 'a long enough prompt', fx: 'rain' }] })), /неизвестные частицы/);
  assert.throws(() => validateShots(content, { scholars: { nobody: { beats: {} } } }), /нет такого учёного/);
});

test('three.js is served locally for the 3D scenes', async () => {
  const res = await fetch(`${base}/vendor/three/three.module.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
});

test('unknown API path is a JSON 404, site pages are served', async () => {
  assert.equal((await get('/api/nothing')).status, 404);
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await page.text(), /Дом мудрости/);
});
