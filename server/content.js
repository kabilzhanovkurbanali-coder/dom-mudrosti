import { readFileSync } from 'node:fs';
import { validateFilms, validateShots } from './film.js';

const CONTENT_FILE = new URL('../data/scholars.json', import.meta.url);
const FILMS_FILE = new URL('../data/films.json', import.meta.url);
const VOICEOVER_FILE = new URL('../data/voiceover.json', import.meta.url);
const SHOTS_FILE = new URL('../data/shots.json', import.meta.url);

// Catches typos in the JSON (unknown field, duplicate slug, missing story)
// at startup instead of as a broken page later.
export function validateContent(content) {
  const problems = [];
  const fieldIds = new Set(content.fields.map((f) => f.id));
  const eraIds = new Set(content.eras.map((e) => e.id));
  const slugs = new Set();

  for (const s of content.scholars) {
    const where = s.slug || s.name || '(без slug)';
    if (!/^[a-z0-9-]+$/.test(s.slug ?? '')) problems.push(`${where}: slug должен состоять из a-z, 0-9 и дефисов`);
    if (slugs.has(s.slug)) problems.push(`${where}: slug повторяется`);
    slugs.add(s.slug);
    if (!eraIds.has(s.era)) problems.push(`${where}: неизвестная эпоха «${s.era}»`);
    for (const f of s.fields ?? []) {
      if (!fieldIds.has(f)) problems.push(`${where}: неизвестная область «${f}»`);
    }
    if (!Number.isInteger(s.bornYear) || !Number.isInteger(s.diedYear) || s.diedYear < s.bornYear) {
      problems.push(`${where}: неверные годы жизни`);
    }
    if (!s.story?.title || !s.story?.paragraphs?.length) problems.push(`${where}: нет рассказа`);
    for (const key of ['name', 'lifespan', 'birthplace', 'summary', 'legacy']) {
      if (!s[key]) problems.push(`${where}: не заполнено поле ${key}`);
    }
  }

  if (problems.length) {
    throw new Error(`Ошибки в data/scholars.json:\n- ${problems.join('\n- ')}`);
  }
  return content;
}

export function loadContent() {
  return validateContent(JSON.parse(readFileSync(CONTENT_FILE, 'utf8')));
}

export function loadFilmScripts(content) {
  const shots = validateShots(content, JSON.parse(readFileSync(SHOTS_FILE, 'utf8')));
  const scripts = validateFilms(content, JSON.parse(readFileSync(FILMS_FILE, 'utf8')), shots);
  return Object.fromEntries(Object.entries(scripts).filter(([key]) => !key.startsWith('_')));
}

// Voice-over lines and the storyboard of the films (see data/*.json).
export function loadFilmMedia(content) {
  const voiceover = JSON.parse(readFileSync(VOICEOVER_FILE, 'utf8'));
  const problems = [];
  for (const [slug, vo] of Object.entries(voiceover)) {
    if (slug.startsWith('_')) continue;
    if (!content.scholars.some((s) => s.slug === slug)) problems.push(`${slug}: нет такого учёного`);
    for (const key of ['hook', 'intro']) {
      if (typeof vo[key] !== 'string' || !vo[key].trim()) problems.push(`${slug}: не заполнено поле ${key}`);
    }
  }
  if (problems.length) throw new Error(`Ошибки в data/voiceover.json:\n- ${problems.join('\n- ')}`);
  const shots = validateShots(content, JSON.parse(readFileSync(SHOTS_FILE, 'utf8')));
  return { voiceover, shots };
}
