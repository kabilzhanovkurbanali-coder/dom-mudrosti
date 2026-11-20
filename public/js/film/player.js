import { api } from '../api.js';
import { createEngine } from './engine.js';
import { createScore } from './score.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
const clamp = (v) => Math.min(1, Math.max(0, v));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Roughly how fast the narrator speaks, for parts without an audio file.
const CHARS_PER_SECOND = 14;
const PAUSE_BETWEEN_PARTS = 450;
const UI_IDLE_MS = 2600;

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM19 5.5v13L9.5 12z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM5 5.5v13L14.5 12z" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

function splitSentences(text) {
  const parts = text.split(/(?<=[.!?…])\s+(?=[«(А-ЯЁA-Z0-9—])/u);
  const total = parts.reduce((sum, s) => sum + s.length, 0);
  let acc = 0;
  return parts.map((s) => {
    acc += s.length;
    return { text: s, end: acc / total };
  });
}

// Word timings come without punctuation; put it back from the spoken text,
// so «Дом мудрости», commas and dashes appear in the subtitles.
export function tokensFromTimings(speech, words) {
  const tokens = [];
  let cursor = 0;
  for (const [s, e, w] of words) {
    const at = speech.indexOf(w, cursor);
    if (at === -1) {
      tokens.push({ s, e, text: w });
      continue;
    }
    const lead = speech.slice(cursor, at);
    if (tokens.length && lead.trim()) {
      // Text before the last space closes the previous word, the rest opens this one.
      const split = /\s\S*$/.exec(lead);
      const trailing = split ? lead.slice(0, split.index) : /\s$/.test(lead) ? lead : '';
      const leading = split ? lead.slice(split.index) : /\s$/.test(lead) ? '' : lead;
      tokens.at(-1).text += trailing.trim() ? ` ${trailing.trim()}`.replace(/^ (?=[,.;:!?…»)])/, '') : '';
      tokens.push({ s, e, text: leading.trim() + w });
    } else {
      tokens.push({ s, e, text: lead.trim() + w });
    }
    cursor = at + w.length;
  }
  const rest = speech.slice(cursor).trim();
  if (rest && tokens.length) tokens.at(-1).text += rest;
  return tokens;
}

// Short lines of subtitles, broken after sentences and at pauses.
export function phrasesFromTokens(tokens, maxChars = 44) {
  const phrases = [];
  let cur = [];
  let len = 0;
  const flush = () => {
    if (cur.length) phrases.push({ start: cur[0].s, end: cur.at(-1).e, tokens: cur });
    cur = [];
    len = 0;
  };
  let inBrackets = false;
  for (const t of tokens) {
    // Keep «(Байт аль-Хикма)» on one line unless it gets far too long.
    if (len && len + t.text.length > (inBrackets ? maxChars + 18 : maxChars)) flush();
    if (t.text.includes('(')) inBrackets = true;
    if (t.text.includes(')')) inBrackets = false;
    cur.push(t);
    len += t.text.length + 1;
    if (/[.!?…]»?$/.test(t.text) || (len > 22 && /[,;:—]$/.test(t.text))) flush();
  }
  flush();
  return phrases;
}

// Cut points between shots, moved to the nearest end of a sentence.
// A shot's weight is its share of the time (the 3D animations get more).
function cutsFor(shots, tokens, duration) {
  const count = shots.length;
  if (count <= 1) return [0];
  const weights = shots.map((s) => s.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const ends = tokens.filter((t) => /[.!?…]»?$/.test(t.text) || /[,;:—]$/.test(t.text)).map((t) => ({
    time: t.e,
    strong: /[.!?…]»?$/.test(t.text),
  }));
  const cuts = [0];
  let acc = 0;
  for (let i = 1; i < count; i++) {
    acc += weights[i - 1];
    const ideal = (duration * acc) / total;
    const window = (duration / count) * 0.35;
    const near = ends
      .filter((e) => Math.abs(e.time - ideal) < window && e.time / duration > cuts.at(-1) + 0.08)
      .sort((a, b) => Math.abs(a.time - ideal) - (a.strong ? 0.8 : 0) - (Math.abs(b.time - ideal) - (b.strong ? 0.8 : 0)))[0];
    cuts.push(clamp((near ? near.time + 0.15 : ideal) / duration));
  }
  return cuts;
}

// Without word timings: cut by weight only.
const weightedCuts = (shots) => cutsFor(shots, [], 1);

function chapterLabel(beat) {
  if (beat.kind === 'intro') return 'Вступление';
  return beat.title;
}

export async function openFilm(slug, { onClose, preview = null } = {}) {
  const film = await api.film(slug);
  const { scholar, beats } = film;
  const totalChars = beats.reduce((sum, b) => sum + b.text.length, 0);
  const minutes = Math.max(1, Math.round(totalChars / CHARS_PER_SECOND / 60));
  const cinematic = beats.some((b) => b.shots?.length);
  const posterShots = beats[0].shots ?? [];

  const root = document.createElement('div');
  root.className = preview ? 'film' : 'film film-idle';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Фильм: ${scholar.name}`);
  root.innerHTML = `
    <canvas class="film-canvas" aria-hidden="true"></canvas>
    <div class="film-vignette" aria-hidden="true"></div>
    <header class="film-top">
      <p class="film-chapter"><span class="film-kicker"></span><span class="film-chapter-title"></span></p>
      <button class="film-btn" type="button" data-action="close" aria-label="Закрыть фильм" title="Закрыть (Esc)">${ICONS.close}</button>
    </header>
    <div class="film-titlecard" hidden>
      <p class="film-eyebrow">${esc(scholar.lifespan)}</p>
      <h1>${esc(scholar.name)}</h1>
      <p class="film-fullname">${esc(scholar.fullName)}</p>
    </div>
    <div class="film-fact" hidden aria-hidden="true"><b></b><span></span></div>
    <div class="film-bottom">
      <p class="film-subtitle" aria-hidden="true"></p>
      <div class="film-ui">
        <div class="film-progress">${beats.map((b, i) => `<button type="button" data-beat="${i}" aria-label="Часть ${i + 1}: ${esc(chapterLabel(b))}"><i></i></button>`).join('')}</div>
        <div class="film-controls">
          <button class="film-btn" type="button" data-action="prev" aria-label="Предыдущая часть" title="Предыдущая часть (←)">${ICONS.prev}</button>
          <button class="film-btn film-btn-main" type="button" data-action="toggle" aria-label="Пауза" title="Пауза (пробел)">${ICONS.pause}</button>
          <button class="film-btn" type="button" data-action="next" aria-label="Следующая часть" title="Следующая часть (→)">${ICONS.next}</button>
          <span class="film-count"></span>
          <span class="film-spacer"></span>
          <button class="film-btn" type="button" data-action="mute" aria-label="Выключить звук" title="Звук (M)">${ICONS.sound}</button>
          <button class="film-btn" type="button" data-action="fullscreen" aria-label="Во весь экран" title="Во весь экран (F)">${ICONS.full}</button>
        </div>
      </div>
    </div>
    <div class="film-start">
      <p class="film-eyebrow">Фильм · ${esc(scholar.lifespan)}</p>
      <h1>${esc(scholar.name)}</h1>
      <p class="film-fullname">${esc(scholar.fullName)}</p>
      <button class="film-play" type="button" data-action="start">${ICONS.play}<span>Смотреть фильм</span></button>
      <p class="film-note">${beats.length} частей · около ${minutes} мин · ${film.voice ? 'озвучка и музыка' : 'озвучка голосом браузера'}</p>
      ${cinematic ? '<p class="film-disclaimer">Кадры — художественная реконструкция, созданная нейросетью. Факты — в тексте рассказа.</p>' : ''}
    </div>
    <div class="film-end" hidden>
      <p class="film-eyebrow">Конец фильма</p>
      <h1>${esc(scholar.name)}</h1>
      <div class="film-end-actions">
        <button class="film-play" type="button" data-action="restart">${ICONS.play}<span>Смотреть снова</span></button>
        <a class="film-link" href="#/scholars/${esc(scholar.slug)}">Читать рассказ</a>
        ${film.next ? `<a class="film-link film-link-next" href="#/film/${esc(film.next.slug)}">Следующий фильм: ${esc(film.next.name)} →</a>` : ''}
      </div>
    </div>
    <p class="visually-hidden" aria-live="polite" data-announce></p>`;
  document.body.append(root);
  document.body.classList.add('film-open');

  const $ = (sel) => root.querySelector(sel);
  const canvas = $('.film-canvas');
  const subtitle = $('.film-subtitle');
  const kicker = $('.film-kicker');
  const chapterTitle = $('.film-chapter-title');
  const count = $('.film-count');
  const titlecard = $('.film-titlecard');
  const factEl = $('.film-fact');
  const startCard = $('.film-start');
  const endCard = $('.film-end');
  const announce = $('[data-announce]');
  const toggleBtn = $('[data-action="toggle"]');
  const muteBtn = $('[data-action="mute"]');
  const segments = [...root.querySelectorAll('.film-progress i')];

  try {
    await Promise.race([Promise.all([document.fonts?.load('600 64px Inter'), document.fonts?.load('600 64px "Cormorant Garamond"')]), wait(1500)]);
  } catch {
    // The scenes fall back to the system font.
  }

  const engine = createEngine(canvas);
  if (!engine) root.classList.add('film-no-3d');

  const audio = new Audio();
  audio.preload = 'auto';
  // Films in other tabs pause when this one starts, so voices never overlap.
  const id = Math.random().toString(36).slice(2);
  const filmChannel = 'BroadcastChannel' in window ? new BroadcastChannel('dom-mudrosti-film') : null;
  if (filmChannel) {
    filmChannel.onmessage = (event) => {
      if (event.data?.playing && event.data.playing !== id && playing) pause();
    };
  }
  let score = null;
  let index = 0;
  let playing = false;
  let muted = false;
  let mode = 'audio';
  let sentences = [];
  let phrases = [];
  let tokens = [];
  let phraseShown = -1;
  let clockBase = 0;
  let clockStart = 0;
  let estimate = 1;
  let token = 0;
  let finished = false;
  let destroyed = false;
  const timingsCache = new Map();

  const clockElapsed = () => clockBase + (playing ? (performance.now() - clockStart) / 1000 : 0);
  const progress = () => {
    if (preview) return preview.p;
    if (!startCard.hidden) return 0.12;
    if (mode === 'audio' && audio.duration) return clamp(audio.currentTime / audio.duration);
    return clamp(clockElapsed() / estimate);
  };
  engine?.setProgress(progress);

  function loadTimings(beat) {
    if (!beat?.timings) return Promise.resolve(null);
    if (!timingsCache.has(beat.timings)) {
      timingsCache.set(
        beat.timings,
        fetch(beat.timings)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      );
    }
    return timingsCache.get(beat.timings);
  }

  function setPlayingUi(value) {
    toggleBtn.innerHTML = value ? ICONS.pause : ICONS.play;
    toggleBtn.setAttribute('aria-label', value ? 'Пауза' : 'Продолжить');
    toggleBtn.title = value ? 'Пауза (пробел)' : 'Продолжить (пробел)';
    root.classList.toggle('film-paused', !value);
  }

  function setChapter(beat, i) {
    kicker.textContent = `${i + 1} / ${beats.length}${beat.kind === 'discovery' ? ' · Открытие' : ''}`;
    chapterTitle.textContent = chapterLabel(beat);
    count.textContent = `Часть ${i + 1} из ${beats.length}`;
    announce.textContent = `Часть ${i + 1}: ${chapterLabel(beat)}`;
    root.dataset.kind = beat.kind;
    titlecard.hidden = true;
    hideFact();
  }

  function showTitle() {
    titlecard.hidden = false;
    titlecard.classList.remove('is-in');
    void titlecard.offsetWidth;
    titlecard.classList.add('is-in');
  }

  function showFact(fact) {
    factEl.querySelector('b').textContent = fact.big;
    factEl.querySelector('span').textContent = fact.small ?? '';
    factEl.hidden = false;
    factEl.classList.remove('is-in');
    void factEl.offsetWidth;
    factEl.classList.add('is-in');
    score?.hit('fact');
  }

  function hideFact() {
    factEl.hidden = true;
    factEl.classList.remove('is-in');
  }

  function onShot(beat) {
    return (i, shot) => {
      if (i > 0) score?.hit('cut');
      hideFact();
      if (shot.fact) setTimeout(() => shot === currentShot && showFact(shot.fact), 700);
      currentShot = shot;
      const titleShot = Math.min(1, beat.shots.length - 1);
      if (beat.kind === 'intro' && i === titleShot) {
        showTitle();
        score?.hit('title');
      } else if (beat.kind === 'intro') titlecard.hidden = true;
    };
  }
  let currentShot = null;

  function renderPhrase(i) {
    phraseShown = i;
    const phrase = phrases[i];
    subtitle.innerHTML = phrase ? phrase.tokens.map((t) => `<span>${esc(t.text)}</span>`).join(' ') : '';
  }

  // Starts the narration file. The browser voice is used only when the file
  // cannot be loaded at all — never in addition to the narrator.
  function playNarration(beat, mine) {
    audio.play().catch((error) => {
      if (mine !== token || destroyed) return;
      // Another part replaced this one, or the browser wants a click first.
      if (error?.name === 'AbortError') return;
      if (error?.name === 'NotAllowedError') {
        pause();
        return;
      }
      speak(beat, progress());
    });
  }

  function speak(beat, from = 0) {
    // Only one film may speak at a time.
    if (mode === 'audio' && !audio.paused) return;
    if (!('speechSynthesis' in window) || muted) {
      mode = 'timer';
      return;
    }
    mode = 'speech';
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(beat.speech.slice(Math.floor(beat.speech.length * from)));
    u.lang = 'ru-RU';
    const voice = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('ru'));
    if (voice) u.voice = voice;
    const mine = token;
    u.onend = () => {
      if (mine === token && mode === 'speech') {
        clockBase = estimate;
        onPartEnd();
      }
    };
    speechSynthesis.speak(u);
  }

  function showBeatPicture(beat, cuts, seconds = 0) {
    if (!engine) return;
    if (beat.shots?.length) engine.showShots(beat.shots, cuts, onShot(beat), seconds);
    else {
      engine.show(beat.scene, beat.params);
      if (beat.kind === 'intro') showTitle();
    }
  }

  async function goTo(i) {
    if (i < 0 || i >= beats.length) return;
    const mine = ++token;
    index = i;
    finished = false;
    endCard.hidden = true;
    engine?.setBlack(false);
    const beat = beats[i];
    sentences = splitSentences(beat.speech);
    phrases = [];
    tokens = [];
    phraseShown = -1;
    subtitle.textContent = '';
    estimate = Math.max(6, beat.text.length / CHARS_PER_SECOND);
    clockBase = 0;
    clockStart = performance.now();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    audio.pause();
    setChapter(beat, i);
    score?.setMood(beat.kind);

    // Called synchronously from the click, so browsers allow the sound to start.
    mode = beat.audio ? 'audio' : 'speech';
    if (beat.audio) {
      audio.src = beat.audio;
      audio.muted = muted;
      if (playing) playNarration(beat, mine);
    }

    const timings = await Promise.race([loadTimings(beat), wait(1500).then(() => null)]);
    if (mine !== token || destroyed) return;
    if (timings?.words?.length) {
      tokens = tokensFromTimings(beat.speech, timings.words);
      phrases = phrasesFromTokens(tokens);
    }
    const duration = () => audio.duration || (tokens.at(-1)?.e ?? estimate) + 0.4;
    const count = beat.shots?.length ?? 0;
    showBeatPicture(beat, tokens.length ? cutsFor(beat.shots ?? [], tokens, duration()) : weightedCuts(beat.shots ?? []), duration());
    if (count && !audio.duration && beat.audio) {
      audio.addEventListener(
        'loadedmetadata',
        () => mine === token && engine?.setCuts(tokens.length ? cutsFor(beat.shots, tokens, audio.duration) : weightedCuts(beat.shots), audio.duration),
        { once: true },
      );
    }

    if (!beat.audio && playing) speak(beat);
    const next = beats[i + 1];
    if (next) {
      if (next.audio) fetch(next.audio).catch(() => {});
      loadTimings(next);
      engine?.preload(next.shots);
    }
  }

  function onPartEnd() {
    const mine = token;
    score?.voice(false);
    setTimeout(() => {
      if (mine !== token || destroyed || !playing) return;
      if (index + 1 < beats.length) goTo(index + 1);
      else finish();
    }, PAUSE_BETWEEN_PARTS);
  }

  function finish() {
    finished = true;
    playing = false;
    setPlayingUi(false);
    engine?.setPlaying(false);
    engine?.setBlack(true);
    score?.end();
    hideFact();
    subtitle.textContent = '';
    endCard.hidden = false;
    root.classList.remove('film-ui-hidden');
    endCard.querySelector('[data-action="restart"]').focus();
  }

  audio.addEventListener('ended', () => {
    if (mode === 'audio') onPartEnd();
  });
  audio.addEventListener('playing', () => score?.voice(true));
  audio.addEventListener('pause', () => score?.voice(false));
  audio.addEventListener('error', () => {
    // No narration file (for example, the server has no voice): use the browser voice.
    if (!destroyed && mode === 'audio' && audio.getAttribute('src') && playing) {
      mode = 'speech';
      speak(beats[index], progress());
    }
  });
  audio.addEventListener('playing', () => {
    // The narrator is speaking: make sure the browser voice is silent.
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    mode = 'audio';
    filmChannel?.postMessage({ playing: id });
  });

  function startSound() {
    if (score || preview) return;
    score = createScore();
    if (score && !score.connectVoice(audio)) {
      // Without the voice chain the narration still plays directly.
    }
    score?.setMuted(muted);
    score?.start();
  }

  function play() {
    if (finished) {
      playing = true;
      score?.start();
      goTo(0);
    }
    resume();
  }

  function resume() {
    playing = true;
    setPlayingUi(true);
    engine?.setPlaying(true);
    score?.resume();
    clockStart = performance.now();
    if (mode === 'audio') playNarration(beats[index], token);
    else if (mode === 'speech') {
      if (speechSynthesis.paused) speechSynthesis.resume();
      else if (!speechSynthesis.speaking) speak(beats[index], progress());
    }
  }

  function pause() {
    clockBase = clockElapsed();
    playing = false;
    setPlayingUi(false);
    engine?.setPlaying(false);
    audio.pause();
    score?.pause();
    if (mode === 'speech') speechSynthesis.pause();
    root.classList.remove('film-ui-hidden');
  }

  function setMuted(value) {
    muted = value;
    audio.muted = value;
    score?.setMuted(value);
    muteBtn.innerHTML = value ? ICONS.muted : ICONS.sound;
    muteBtn.setAttribute('aria-label', value ? 'Включить звук' : 'Выключить звук');
    if (mode === 'speech' && value) {
      clockBase = clockElapsed();
      clockStart = performance.now();
      speechSynthesis.cancel();
      mode = 'timer';
    }
  }

  // Subtitles, progress bars and the timer-only mode are driven here.
  let uiFrame = 0;
  const tick = () => {
    if (destroyed) return;
    uiFrame = requestAnimationFrame(tick);
    const p = progress();
    if (phrases.length && mode === 'audio') {
      const t = audio.currentTime;
      let i = phrases.findIndex((ph, k) => t < (phrases[k + 1]?.start ?? Infinity) - 0.05);
      if (i === -1) i = phrases.length - 1;
      if (i !== phraseShown) renderPhrase(i);
      const spans = subtitle.children;
      phrases[i]?.tokens.forEach((tk, k) => {
        const on = t >= tk.s - 0.03;
        spans[k]?.classList.toggle('is-on', on);
        spans[k]?.classList.toggle('is-now', on && t < tk.e + 0.12);
      });
    } else if (startCard.hidden || preview) {
      const line = sentences.find((s) => s.end >= p - 1e-6) ?? sentences.at(-1);
      if (line && subtitle.textContent !== line.text) subtitle.textContent = line.text;
    }
    segments.forEach((seg, i) => {
      seg.style.transform = `scaleX(${i < index ? 1 : i > index ? 0 : p})`;
    });
    if (playing && mode === 'timer' && clockElapsed() >= estimate && !tick.waiting) {
      tick.waiting = true;
      onPartEnd();
      setTimeout(() => (tick.waiting = false), PAUSE_BETWEEN_PARTS + 50);
    }
  };
  tick();

  // The controls hide while the film plays and the pointer rests.
  let idleTimer = 0;
  const wake = () => {
    root.classList.remove('film-ui-hidden');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (playing && !root.contains(document.activeElement?.closest?.('.film-ui') ?? null)) root.classList.add('film-ui-hidden');
    }, UI_IDLE_MS);
  };
  root.addEventListener('pointermove', wake);
  root.addEventListener('pointerdown', wake);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.requestFullscreen?.().catch(() => {});
  };

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    token += 1;
    cancelAnimationFrame(uiFrame);
    clearTimeout(idleTimer);
    audio.pause();
    audio.removeAttribute('src');
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    score?.destroy();
    filmChannel?.close();
    engine?.destroy();
    document.removeEventListener('keydown', onKey);
    if (document.fullscreenElement === root) document.exitFullscreen?.();
    root.remove();
    document.body.classList.remove('film-open');
  }

  function begin() {
    startCard.hidden = true;
    root.classList.remove('film-idle');
    startSound();
    playing = true;
    setPlayingUi(true);
    engine?.setPlaying(true);
    goTo(0);
    wake();
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action], [data-beat]');
    if (!button) return;
    const action = button.dataset.action;
    if (button.dataset.beat !== undefined) {
      if (!startCard.hidden) return begin();
      if (!playing) {
        playing = true;
        setPlayingUi(true);
        engine?.setPlaying(true);
        score?.resume();
        score?.start();
      }
      goTo(Number(button.dataset.beat));
    } else if (action === 'start' || action === 'restart') {
      if (action === 'restart') score?.start();
      begin();
    } else if (action === 'toggle') {
      if (playing) pause();
      else play();
    } else if (action === 'prev') goTo(Math.max(0, index - 1));
    else if (action === 'next') goTo(Math.min(beats.length - 1, index + 1));
    else if (action === 'mute') setMuted(!muted);
    else if (action === 'fullscreen') toggleFullscreen();
    else if (action === 'close') onClose?.();
  });
  function onKey(event) {
    if (event.target.closest?.('input, textarea')) return;
    wake();
    if (event.key === 'Escape') onClose?.();
    else if (!startCard.hidden) return;
    else if (event.key === ' ' || event.key === 'k') {
      event.preventDefault();
      if (playing) pause();
      else play();
    } else if (event.key === 'ArrowRight') goTo(Math.min(beats.length - 1, index + 1));
    else if (event.key === 'ArrowLeft') goTo(Math.max(0, index - 1));
    else if (event.key === 'm' || event.key === 'ь') setMuted(!muted);
    else if (event.key === 'f' || event.key === 'а') toggleFullscreen();
  }
  document.addEventListener('keydown', onKey);

  if (preview) {
    // Still frame of one part — used to check scenes without sound.
    startCard.hidden = true;
    root.classList.remove('film-idle');
    const beat = beats[Math.min(preview.beat, beats.length - 1)];
    index = beats.indexOf(beat);
    sentences = splitSentences(beat.speech);
    setChapter(beat, index);
    showBeatPicture(beat, weightedCuts(beat.shots ?? []));
    engine?.setPlaying(false);
    engine?.seek(preview.p * 40);
  } else {
    // A living poster behind the start screen.
    if (engine && posterShots.length) engine.showShots(posterShots.slice(0, 1), [0], () => {});
    else engine?.show('title', {});
    engine?.setPlaying(false);
    $('[data-action="start"]').focus();
  }

  return { destroy };
}
