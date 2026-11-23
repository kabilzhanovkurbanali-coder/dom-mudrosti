import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speechText } from './speech.js';

const MEDIA_DIR = fileURLToPath(new URL('../public/media/shots', import.meta.url));

export const CAMERA_MOVES = ['push', 'pull', 'left', 'right', 'rise', 'fall', 'drift'];
export const PARTICLES = ['dust', 'embers', 'mist', 'stars', 'gold', 'smoke', 'none'];
// Parts of the storyboard (data/shots.json) besides story:N.
const STORYBOARD_PARTS = ['portrait', 'intro', 'legend', 'legacy'];

// File name of a shot: «story:2», 0 → «s2-1».
export function shotName(ref, index) {
  const key = ref.startsWith('story:') ? `s${ref.slice(6)}` : ref;
  return `${key}-${index + 1}`;
}

// All storyboard shots of a scholar by file name: { 's2-1': { p, m, fx, fact } }.
function storyboard(shots, slug) {
  const byName = {};
  for (const [ref, list] of Object.entries(shots?.scholars?.[slug]?.beats ?? {})) {
    list.forEach((shot, i) => {
      byName[shotName(ref, i)] = shot;
    });
  }
  return byName;
}

// Checks the short films: real scholars, a text for every part,
// photos that exist in the storyboard, an animation where one is asked for.
export function validateFilms(content, scripts, shots = null) {
  const problems = [];
  for (const [slug, beats] of Object.entries(scripts)) {
    if (slug.startsWith('_')) continue;
    if (!content.scholars.some((s) => s.slug === slug)) {
      problems.push(`${slug}: нет такого учёного`);
      continue;
    }
    if (!Array.isArray(beats) || !beats.length) problems.push(`${slug}: в фильме нет частей`);
    const known = shots ? storyboard(shots, slug) : null;
    for (const [i, beat] of (beats ?? []).entries()) {
      const where = `${slug}, часть ${i + 1}`;
      if (typeof beat.say !== 'string' || beat.say.trim().length < 20) problems.push(`${where}: нет закадрового текста`);
      if (typeof beat.title !== 'string' || !beat.title.trim()) problems.push(`${where}: нет заголовка`);
      if (beat.animate && typeof beat.scene !== 'string') problems.push(`${where}: animate без сцены`);
      if (!beat.animate && !beat.photos?.length) problems.push(`${where}: нет ни кадров, ни анимации`);
      for (const name of beat.photos ?? []) {
        if (known && !known[name]) problems.push(`${where}: нет кадра «${name}» в раскадровке`);
      }
    }
  }
  if (problems.length) throw new Error(`Ошибки в data/films.json:\n- ${problems.join('\n- ')}`);
  return scripts;
}

// Checks the storyboard: real scholars and parts, known camera moves and particles.
export function validateShots(content, shots) {
  const problems = [];
  for (const [slug, entry] of Object.entries(shots.scholars ?? {})) {
    const scholar = content.scholars.find((s) => s.slug === slug);
    if (!scholar) {
      problems.push(`${slug}: нет такого учёного`);
      continue;
    }
    for (const [ref, list] of Object.entries(entry.beats ?? {})) {
      const story = /^story:(\d+)$/.exec(ref);
      const known = STORYBOARD_PARTS.includes(ref) || (story && Number(story[1]) < scholar.story.paragraphs.length);
      if (!known) problems.push(`${slug}: нет части «${ref}»`);
      if (ref === 'legend' && !scholar.legend) problems.push(`${slug}: у учёного нет предания`);
      if (!Array.isArray(list) || !list.length) problems.push(`${slug}/${ref}: нет кадров`);
      for (const [i, shot] of (list ?? []).entries()) {
        const where = `${slug}/${ref}/${i + 1}`;
        if (typeof shot.p !== 'string' || shot.p.length < 10) problems.push(`${where}: нет описания кадра`);
        if (shot.m && !CAMERA_MOVES.includes(shot.m)) problems.push(`${where}: неизвестное движение «${shot.m}»`);
        if (shot.fx && !PARTICLES.includes(shot.fx)) problems.push(`${where}: неизвестные частицы «${shot.fx}»`);
        if (shot.fact && (!Array.isArray(shot.fact) || typeof shot.fact[0] !== 'string')) problems.push(`${where}: fact — это [главное, пояснение]`);
      }
    }
  }
  if (problems.length) throw new Error(`Ошибки в data/shots.json:\n- ${problems.join('\n- ')}`);
  return shots;
}

// Photos whose pictures exist. Checked on each request, so pictures
// generated while the server runs appear without a restart.
function readyPhotos(names, board, slug, mediaDir) {
  return names.flatMap((name) => {
    const file = `${slug}/${name}`;
    if (!existsSync(path.join(mediaDir, `${file}.jpg`))) return [];
    const shot = board[name] ?? {};
    const depth = existsSync(path.join(mediaDir, `${file}.depth.png`));
    return [{
      src: `/media/shots/${file}.jpg`,
      depth: depth ? `/media/shots/${file}.depth.png` : null,
      move: shot.m ?? 'push',
      fx: shot.fx ?? 'dust',
      fact: shot.fact ? { big: shot.fact[0], small: shot.fact[1] ?? '' } : null,
    }];
  });
}

// A part about a discovery: one picture sets the scene, then the 3D
// animation shows how it was done and takes most of the time.
// «animate: "only"» gives the whole part to the animation.
export const ANIMATION_WEIGHT = 2.6;
function withAnimation(photos, beat, who) {
  // «who» tells the animation which scholar to dress its 3D figure as.
  const animation = { scene: beat.scene, params: { ...(beat.params ?? {}), who }, weight: ANIMATION_WEIGHT };
  return photos.length && beat.animate !== 'only' ? [{ ...photos[0], weight: 1 }, animation] : [animation];
}

// A scholar without a hand-made film still gets a short one from the article.
function defaultScript(scholar) {
  return [
    { title: scholar.story.title, say: scholar.story.paragraphs[0], photos: ['s0-1', 's0-2'] },
    { kind: 'legacy', title: 'Наследие', say: scholar.legacy, photos: ['legacy-1'] },
  ];
}

export function buildFilms(content, scripts, narrator, { voiceover = {}, shots = {}, mediaDir = MEDIA_DIR } = {}) {
  const order = [...content.scholars].sort((a, b) => a.bornYear - b.bornYear);
  const films = new Map();

  const voiced = (b) => {
    const speech = speechText(b.text);
    const id = narrator?.register(speech);
    const playable = Boolean(id && (narrator.playable?.(id) ?? narrator.available));
    return {
      ...b,
      speech,
      audio: playable ? `/api/narration/${id}.${narrator.ext ?? 'm4a'}` : null,
      timings: playable && narrator.timings ? `/api/narration/${id}.json` : null,
    };
  };

  order.forEach((s, i) => {
    const vo = voiceover[s.slug];
    const next = order[i + 1];
    const board = storyboard(shots, s.slug);
    const beats = [
      {
        kind: 'intro',
        title: s.name,
        text: vo ? `${vo.hook} ${vo.intro}` : `${s.name}. ${s.summary}`,
        scene: 'title',
        params: {},
        photos: ['intro-1', 'portrait-1'],
        animate: false,
      },
      ...(scripts[s.slug] ?? defaultScript(s)).map((b) => ({
        kind: b.kind ?? (b.animate ? 'discovery' : 'story'),
        title: b.title,
        text: b.say,
        scene: b.scene ?? 'library',
        params: b.params ?? {},
        photos: b.photos ?? [],
        animate: b.animate ?? false,
      })),
    ];

    const voicedBeats = beats.map((b, index) => ({ index, ...voiced(b) }));
    films.set(s.slug, (/* per request */) => ({
      scholar: { slug: s.slug, name: s.name, fullName: s.fullName, lifespan: s.lifespan, birthplace: s.birthplace },
      next: next ? { slug: next.slug, name: next.name } : null,
      voice: narrator?.voice ?? null,
      beats: voicedBeats.map((b) => {
        const { animate, photos: names, ...beat } = b;
        const photos = readyPhotos(names, board, s.slug, mediaDir);
        return { ...beat, shots: animate ? withAnimation(photos, b, s.slug) : photos };
      }),
    }));
  });

  return films;
}

// Names of all pictures the films show, for the shot generator.
export function usedPhotos(content, scripts) {
  const used = {};
  for (const s of content.scholars) {
    const names = new Set(['intro-1', 'portrait-1']);
    for (const b of scripts[s.slug] ?? defaultScript(s)) {
      const photos = b.photos ?? [];
      (b.animate ? photos.slice(0, b.animate === 'only' ? 0 : 1) : photos).forEach((n) => names.add(n));
    }
    used[s.slug] = [...names];
  }
  return used;
}
