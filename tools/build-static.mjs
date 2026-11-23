// Builds a static copy of the site in dist/ for hosting without the Node
// server (Cloudflare Pages, GitHub Pages…): the API answers are saved as
// JSON files, search and filters run in the browser, the narration and the
// film pictures are copied. Comments need the server and are switched off.
//
//   node tools/build-static.mjs        → dist/
import { cp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { loadContent, loadFilmMedia, loadFilmScripts } from '../server/content.js';
import { normalize, openDatabase } from '../server/db.js';
import { createNarrator } from '../server/narration.js';
import { usedPhotos } from '../server/film.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const AUDIO = path.join(ROOT, 'data', 'audio');
const SHOTS = path.join(PUBLIC, 'media', 'shots');

const content = loadContent();
const filmScripts = loadFilmScripts(content);
const filmMedia = loadFilmMedia(content);
const narrator = await createNarrator({ dir: AUDIO });
const app = createApp({ db: openDatabase(':memory:', content), content, filmScripts, filmMedia, narrator });
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}/api`;
const get = async (p) => {
  const res = await fetch(base + p);
  if (!res.ok) throw new Error(`${p}: ${res.status}`);
  return res.json();
};
const writeJson = async (file, data) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
};

await rm(DIST, { recursive: true, force: true });
// Site files without the film pictures (only the used ones are copied below)
// and without anything that is not part of the site.
await cp(PUBLIC, DIST, {
  recursive: true,
  // Of the scholars' figures only the cut-outs are needed (not their sources).
  filter: (src) =>
    !src.startsWith(SHOTS) && !src.endsWith('.mp4') && !src.endsWith('.DS_Store') && !src.endsWith('.src.jpg') && !src.endsWith('manifest.json'),
});
await mkdir(path.join(DIST, 'vendor', 'three'), { recursive: true });
await copyFile(path.join(ROOT, 'node_modules', 'three', 'build', 'three.module.js'), path.join(DIST, 'vendor', 'three', 'three.module.js'));

// The page knows it is static by this attribute.
const indexFile = path.join(DIST, 'index.html');
await writeFile(indexFile, (await readFile(indexFile, 'utf8')).replace('<html lang="ru">', '<html lang="ru" data-static="1">'));

await writeJson(path.join(DIST, 'api', 'meta.json'), await get('/meta'));
const list = await get('/scholars');
await writeJson(path.join(DIST, 'api', 'scholars.json'), {
  scholars: list.scholars.map((s) => {
    const full = content.scholars.find((x) => x.slug === s.slug);
    const search = normalize([
      full.name, full.fullName, full.latinName, full.birthplace, ...full.places, full.summary, full.story.title,
      ...full.story.paragraphs, full.legend?.title, full.legend?.text, ...full.works.map((w) => `${w.title} ${w.note}`),
      ...full.contributions, full.legacy,
    ].join(' '));
    return { ...s, search };
  }),
});

let audio = 0;
let pictures = 0;
const used = usedPhotos(content, filmScripts);
for (const s of content.scholars) {
  await writeJson(path.join(DIST, 'api', 'scholars', `${s.slug}.json`), await get(`/scholars/${s.slug}`));
  const film = await get(`/scholars/${s.slug}/film`);
  await writeJson(path.join(DIST, 'api', 'films', `${s.slug}.json`), film);
  for (const beat of film.beats) {
    for (const url of [beat.audio, beat.timings]) {
      if (!url) continue;
      const name = path.basename(url);
      await mkdir(path.join(DIST, 'api', 'narration'), { recursive: true });
      await copyFile(path.join(AUDIO, name), path.join(DIST, 'api', 'narration', name));
      audio += 1;
    }
  }
  for (const name of used[s.slug]) {
    for (const file of [`${name}.jpg`, `${name}.depth.png`]) {
      const from = path.join(SHOTS, s.slug, file);
      if (!existsSync(from)) continue;
      await mkdir(path.join(DIST, 'media', 'shots', s.slug), { recursive: true });
      await copyFile(from, path.join(DIST, 'media', 'shots', s.slug, file));
      pictures += 1;
    }
  }
}

// Cache the heavy media for a long time; the pages stay fresh.
await writeFile(
  path.join(DIST, '_headers'),
  ['/media/*', '  Cache-Control: public, max-age=604800', '/api/narration/*', '  Cache-Control: public, max-age=604800', ''].join('\n'),
);

server.close();
console.log(`dist/ готова: ${content.scholars.length} учёных, ${pictures} файлов кадров, ${audio} файлов озвучки`);
