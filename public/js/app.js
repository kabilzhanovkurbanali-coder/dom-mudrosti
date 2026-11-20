import { api, isStatic } from './api.js';

const main = document.getElementById('main');
const tooltip = document.querySelector('.tooltip');

let meta = null;
// Each navigation bumps the token; a slow response for an old page is dropped.
let renderToken = 0;
let activeFilm = null;

const SITE_TITLE = 'Дом мудрости';
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeStyle: 'short' });

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const fieldLabel = (id) => meta.fields.find((f) => f.id === id)?.label ?? id;
const eraOf = (id) => meta.eras.find((e) => e.id === id) ?? { label: id, period: '' };
const scholarHref = (slug) => `#/scholars/${encodeURIComponent(slug)}`;

function setTitle(title) {
  document.title = title ? `${title} — ${SITE_TITLE}` : `${SITE_TITLE} — учёные исламского мира`;
}

function setActiveNav(name) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function tagList(fields) {
  return `<ul class="tags" aria-label="Области науки">${fields
    .map((f) => `<li class="tag">${esc(fieldLabel(f))}</li>`)
    .join('')}</ul>`;
}

function errorView(message) {
  return `<div class="notice">
    <h1>Что-то пошло не так</h1>
    <p>${esc(message)}</p>
    <p><a class="btn" href="#/">На главную</a></p>
  </div>`;
}

/* ---------- Главная: список учёных ---------- */

const posterUrl = (slug, name = 'portrait-1') => `/media/shots/${encodeURIComponent(slug)}/${name}.jpg`;

function scholarCard(s, i = 0) {
  const era = eraOf(s.era);
  return `<article class="card reveal" style="--delay:${Math.min(i, 8) * 60}ms">
    <a class="card-poster" href="#/film/${encodeURIComponent(s.slug)}" style="--poster:url('${posterUrl(s.slug)}')"
       aria-label="Смотреть фильм: ${esc(s.name)}" tabindex="-1">
      <span class="card-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
      <span class="card-years">${esc(s.lifespan)}</span>
    </a>
    <div class="card-body">
      <p class="card-meta">${esc(era.label)} · ${esc(s.birthplace)}</p>
      <h3 class="card-title"><a class="card-link" href="${scholarHref(s.slug)}">${esc(s.name)}</a></h3>
      <p class="card-summary">${esc(s.summary)}</p>
      ${tagList(s.fields)}
      <a class="card-film" href="#/film/${encodeURIComponent(s.slug)}" aria-label="Смотреть фильм: ${esc(s.name)}">▶ Фильм</a>
    </div>
  </article>`;
}

function readHomeState(params) {
  const state = {
    q: params.get('q') ?? '',
    field: params.get('field') ?? '',
    era: params.get('era') ?? '',
    sort: params.get('sort') ?? 'chronology',
  };
  if (!meta.fields.some((f) => f.id === state.field)) state.field = '';
  if (!meta.eras.some((e) => e.id === state.era)) state.era = '';
  if (!['chronology', 'name'].includes(state.sort)) state.sort = 'chronology';
  return state;
}

function option(value, label, selected) {
  return `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
}

function renderHome(params, token) {
  setActiveNav('home');
  setTitle('');
  const state = readHomeState(params);

  main.innerHTML = `
    <section class="hero-cinema" aria-labelledby="hero-title">
      <div class="hero-slides" aria-hidden="true">
        ${HERO_SLIDES.map((slug, i) => `<div class="hero-slide" style="--img:url('${posterUrl(slug, 'intro-1')}');--i:${i}"></div>`).join('')}
      </div>
      <canvas class="hero-dust" aria-hidden="true"></canvas>
      <svg class="hero-star" viewBox="0 0 200 200" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="0.6">
          <path d="M100 18l23.6 23.6h33.4v33.4L182 100l-25 25v33.4h-33.4L100 182l-23.6-23.6H43v-33.4L18 100l25-25V41.6h33.4z"/>
          <rect x="44" y="44" width="112" height="112" transform="rotate(45 100 100)"/>
          <rect x="44" y="44" width="112" height="112"/>
          <circle cx="100" cy="100" r="38"/><circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="8"/>
        </g>
      </svg>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-content">
        <p class="hero-eyebrow">VIII–XVI века · ${meta.total} учёных · ${meta.total} фильмов</p>
        <h1 id="hero-title" class="hero-title" aria-label="Дом мудрости">${[...'Дом мудрости'].map((ch, i) => `<span style="--i:${i}" aria-hidden="true">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</h1>
        <p class="hero-lead">Они измеряли Землю с вершины горы, взламывали шифры, вычисляли число π и строили часы-слона.
          Короткие фильмы об учёных исламского мира — с 3D-анимациями их открытий.</p>
        <div class="hero-buttons">
          <a class="hero-play" href="#/film/al-khwarizmi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>Смотреть первый фильм</a>
          <a class="hero-more" href="#list-title" data-scroll>Все учёные ↓</a>
        </div>
        <dl class="hero-stats">
          <div><dt>учёных</dt><dd data-count="${meta.total}">0</dd></div>
          <div><dt>областей науки</dt><dd data-count="${meta.fields.length}">0</dd></div>
          <div><dt>веков истории</dt><dd data-count="9">0</dd></div>
        </dl>
      </div>
      <a class="hero-scroll" href="#films-title" data-scroll aria-label="К фильмам"><span></span></a>
    </section>

    <section class="films-strip" aria-labelledby="films-title">
      <div class="strip-head reveal">
        <p class="eyebrow">Кинозал</p>
        <h2 id="films-title">Фильмы об учёных</h2>
      </div>
      <div class="strip" role="list"></div>
    </section>

    <section aria-labelledby="list-title">
      <div class="strip-head reveal">
        <p class="eyebrow">Энциклопедия</p>
        <h2 id="list-title">Все учёные</h2>
      </div>
      <form class="filters" role="search">
        <label class="control control-search">
          <span>Поиск</span>
          <input type="search" name="q" value="${esc(state.q)}" placeholder="Имя, город, открытие…" autocomplete="off" maxlength="100">
        </label>
        <label class="control">
          <span>Область науки</span>
          <select name="field">
            ${option('', 'Все области', state.field)}
            ${meta.fields.map((f) => option(f.id, `${f.label} (${f.count})`, state.field)).join('')}
          </select>
        </label>
        <label class="control">
          <span>Эпоха</span>
          <select name="era">
            ${option('', 'Все эпохи', state.era)}
            ${meta.eras.map((e) => option(e.id, `${e.label}, ${e.period}`, state.era)).join('')}
          </select>
        </label>
        <label class="control">
          <span>Порядок</span>
          <select name="sort">
            ${option('chronology', 'По времени', state.sort)}
            ${option('name', 'По алфавиту', state.sort)}
          </select>
        </label>
      </form>
      <p class="result-count" aria-live="polite"></p>
      <div class="grid"></div>
    </section>`;

  const form = main.querySelector('.filters');
  const grid = main.querySelector('.grid');
  const count = main.querySelector('.result-count');
  let listToken = 0;

  async function load() {
    const mine = ++listToken;
    const params = new URLSearchParams(Object.entries(state).filter(([k, v]) => v && !(k === 'sort' && v === 'chronology')));
    const search = params.toString();
    history.replaceState(null, '', `#/${search ? `?${search}` : ''}`);
    grid.setAttribute('aria-busy', 'true');
    try {
      const data = await api.scholars(state);
      if (mine !== listToken || token !== renderToken) return;
      count.textContent = data.count === meta.total ? `Все учёные: ${data.count}` : `Найдено: ${data.count} из ${meta.total}`;
      grid.innerHTML = data.count
        ? data.scholars.map((sc, i) => scholarCard(sc, i)).join('')
        : `<div class="empty"><p>Никого не нашли. Попробуйте другое слово или сбросьте фильтры.</p>
             <button type="button" class="btn btn-quiet" data-reset>Сбросить фильтры</button></div>`;
    } catch (err) {
      if (mine === listToken) grid.innerHTML = `<p class="notice">${esc(err.message)}</p>`;
    } finally {
      grid.removeAttribute('aria-busy');
      revealOnScroll(grid);
    }
  }

  let debounce;
  form.addEventListener('input', (event) => {
    state[event.target.name] = event.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(load, event.target.name === 'q' ? 250 : 0);
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  grid.addEventListener('click', (event) => {
    if (!event.target.closest('[data-reset]')) return;
    Object.assign(state, { q: '', field: '', era: '', sort: 'chronology' });
    form.reset();
    for (const el of form.elements) el.value = state[el.name] ?? '';
    load();
  });

  load();
  initHero(token);
}

/* ---------- Главная: заставка, кинозал, появление при прокрутке ---------- */

// Establishing shots of the films that cross-fade behind the title.
const HERO_SLIDES = ['al-khwarizmi', 'ulugbek', 'az-zahrawi', 'taqi-al-din', 'al-farghani', 'ibn-al-haytham'];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cards and headings fade up as they scroll into view.
function revealOnScroll(root = main) {
  const items = root.querySelectorAll('.reveal:not(.is-in)');
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  items.forEach((el) => observer.observe(el));
}

// Golden dust drifting up through the light of the title screen.
function heroDust(canvas) {
  const g = canvas.getContext('2d');
  if (!g || reducedMotion()) return;
  const motes = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.4 + Math.random() * 1.8,
    v: 0.00006 + Math.random() * 0.00018,
    phase: Math.random() * Math.PI * 2,
  }));
  let last = performance.now();
  const frame = (now) => {
    if (!canvas.isConnected) return;
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - last);
    last = now;
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.y -= m.v * dt;
      if (m.y < -0.05) m.y = 1.05;
      const x = (m.x + Math.sin(now / 3000 + m.phase) * 0.01) * w;
      const twinkle = 0.45 + 0.55 * Math.sin(now / 700 + m.phase);
      const r = m.r * devicePixelRatio;
      const grad = g.createRadialGradient(x, m.y * h, 0, x, m.y * h, r * 4);
      grad.addColorStop(0, `rgba(255,220,150,${0.75 * twinkle})`);
      grad.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, m.y * h, r * 4, 0, Math.PI * 2);
      g.fill();
    }
  };
  requestAnimationFrame(frame);
}

function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  if (reducedMotion()) {
    el.textContent = target;
    return;
  }
  const start = performance.now() + 900;
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, Math.max(0, (now - start) / 1400));
    el.textContent = Math.round(target * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function initHero(token) {
  const hero = main.querySelector('.hero-cinema');
  if (!hero) return;
  heroDust(hero.querySelector('.hero-dust'));
  hero.querySelectorAll('[data-count]').forEach(countUp);
  // Parallax: the title drifts slower than the page.
  const onScroll = () => {
    if (!hero.isConnected) return window.removeEventListener('scroll', onScroll);
    const y = Math.min(window.scrollY, hero.offsetHeight);
    hero.style.setProperty('--scroll', `${y}px`);
  };
  if (!reducedMotion()) window.addEventListener('scroll', onScroll, { passive: true });
  main.addEventListener('click', (event) => {
    const link = event.target.closest('[data-scroll]');
    if (!link) return;
    event.preventDefault();
    document.querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });

  const strip = main.querySelector('.strip');
  try {
    const all = await api.scholars({ sort: 'chronology' });
    if (token !== renderToken) return;
    strip.innerHTML = all.scholars
      .map(
        (sc, i) => `<a class="poster reveal" role="listitem" href="#/film/${encodeURIComponent(sc.slug)}" style="--poster:url('${posterUrl(sc.slug)}');--delay:${Math.min(i, 6) * 70}ms">
          <span class="poster-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
          <span class="poster-text"><span class="poster-years">${esc(sc.lifespan)}</span><span class="poster-name">${esc(sc.name)}</span></span>
        </a>`,
      )
      .join('');
  } catch {
    strip.closest('section').hidden = true;
  }
  revealOnScroll();
}

/* ---------- Страница учёного ---------- */

function commentItem(c) {
  return `<li class="comment">
    <p class="comment-head"><strong>${esc(c.author)}</strong>
      <time datetime="${esc(c.createdAt)}">${esc(dateFormat.format(new Date(c.createdAt)))}</time></p>
    <p class="comment-body">${esc(c.body)}</p>
  </li>`;
}

async function renderScholar(slug, token) {
  setActiveNav('home');
  let data;
  try {
    data = await api.scholar(slug);
  } catch (err) {
    if (token !== renderToken) return;
    setTitle('Не найдено');
    main.innerHTML = err.status === 404 ? errorView('Такого учёного на сайте нет.') : errorView(err.message);
    return;
  }
  if (token !== renderToken) return;

  const s = data.scholar;
  const era = eraOf(s.era);
  setTitle(s.name);

  const pagerLink = (n, dir) =>
    n
      ? `<a class="pager-link pager-${dir}" href="${scholarHref(n.slug)}">
           <span class="pager-dir">${dir === 'prev' ? '← Раньше' : 'Позже →'}</span>
           <span class="pager-name">${esc(n.name)}</span>
           <span class="pager-years">${esc(n.lifespan)}</span>
         </a>`
      : '<span></span>';

  main.innerHTML = `
    <article class="scholar">
      <a class="back" href="#/">← Все учёные</a>
      <header class="scholar-head">
        <p class="eyebrow">${esc(era.label)} · ${esc(era.period)}</p>
        <h1>${esc(s.name)}</h1>
        <p class="full-name">${esc(s.fullName)}</p>
        <dl class="facts">
          <div><dt>Годы жизни</dt><dd>${esc(s.lifespan)}</dd></div>
          <div><dt>Место рождения</dt><dd>${esc(s.birthplace)}</dd></div>
          ${s.latinName ? `<div><dt>Латинское имя</dt><dd lang="la">${esc(s.latinName)}</dd></div>` : ''}
        </dl>
        ${tagList(s.fields)}
        <a class="film-poster" href="#/film/${encodeURIComponent(s.slug)}"
          style="--poster: url('/media/shots/${encodeURIComponent(s.slug)}/intro-1.jpg')">
          <span class="film-poster-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
          <span class="film-poster-text">
            <span class="film-poster-kicker">Смотреть фильм</span>
            <span class="film-poster-title">${esc(s.name)}</span>
            <span class="film-poster-note">озвучка, музыка и кинокадры</span>
          </span>
        </a>
      </header>

      <div class="scholar-body">
        <div class="story">
          <p class="lead">${esc(s.summary)}</p>
          <h2>${esc(s.story.title)}</h2>
          ${s.story.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
          ${
            s.legend
              ? `<aside class="legend-box" aria-labelledby="legend-title">
                   <p class="legend-kicker">Предание или факт?</p>
                   <h3 id="legend-title">${esc(s.legend.title)}</h3>
                   <p>${esc(s.legend.text)}</p>
                 </aside>`
              : ''
          }
          <h2>Наследие</h2>
          <p>${esc(s.legacy)}</p>
        </div>

        <aside class="side">
          <section>
            <h2>Главные труды</h2>
            <ul class="works">
              ${s.works.map((w) => `<li><span class="work-title">${esc(w.title)}</span><span class="work-note">${esc(w.note)}</span></li>`).join('')}
            </ul>
          </section>
          <section>
            <h2>Вклад в науку</h2>
            <ul class="bullets">${s.contributions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          </section>
          <section>
            <h2>Где жил и работал</h2>
            <p>${s.places.map(esc).join(' · ')}</p>
          </section>
        </aside>
      </div>

      <nav class="pager" aria-label="Соседние учёные по времени">
        ${pagerLink(data.prev, 'prev')}
        ${pagerLink(data.next, 'next')}
      </nav>

      <section class="comments" aria-labelledby="comments-title"${isStatic ? ' hidden' : ''}>
        <h2 id="comments-title">Обсуждение <span class="comment-count">(${data.commentCount})</span></h2>
        <form class="comment-form" novalidate>
          <label class="control">
            <span>Ваше имя</span>
            <input name="author" maxlength="60" autocomplete="name" required>
            <span class="control-error" data-error="author"></span>
          </label>
          <label class="control">
            <span>Комментарий или вопрос</span>
            <textarea name="body" rows="4" maxlength="2000" required></textarea>
            <span class="control-error" data-error="body"></span>
          </label>
          <label class="hp" aria-hidden="true">Сайт <input name="website" tabindex="-1" autocomplete="off"></label>
          <div class="form-row">
            <button class="btn" type="submit">Отправить</button>
            <p class="form-status" role="status"></p>
          </div>
        </form>
        <ol class="comment-list"></ol>
      </section>
    </article>`;

  const list = main.querySelector('.comment-list');
  const counter = main.querySelector('.comment-count');
  const form = main.querySelector('.comment-form');
  const status = main.querySelector('.form-status');
  let total = data.commentCount;

  api
    .comments(slug)
    .then(({ comments }) => {
      if (token !== renderToken) return;
      list.innerHTML = comments.length
        ? comments.map(commentItem).join('')
        : '<li class="muted comment-empty">Пока никто не написал. Будьте первым.</li>';
    })
    .catch(() => {
      if (token === renderToken) list.innerHTML = '<li class="muted">Не удалось загрузить комментарии.</li>';
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    for (const el of form.querySelectorAll('[data-error]')) el.textContent = '';
    status.textContent = 'Отправляем…';
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      const { comment } = await api.addComment(slug, payload);
      list.querySelector('.comment-empty')?.remove();
      list.insertAdjacentHTML('afterbegin', commentItem(comment));
      counter.textContent = `(${++total})`;
      form.elements.body.value = '';
      status.textContent = 'Спасибо! Комментарий опубликован.';
    } catch (err) {
      for (const [name, message] of Object.entries(err.fields ?? {})) {
        const slot = form.querySelector(`[data-error="${name}"]`);
        if (slot) slot.textContent = message;
      }
      status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

/* ---------- Хронология ---------- */

const TL_START = 750;
const TL_END = 1600;
const TL_TICKS = [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600];
const pct = (year) => (((year - TL_START) / (TL_END - TL_START)) * 100).toFixed(3);

function showTooltip(html, x, y) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 12;
  const { width, height } = tooltip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + width > window.innerWidth - pad) left = x - width - pad;
  if (top + height > window.innerHeight - pad) top = y - height - pad;
  tooltip.style.left = `${Math.max(pad, left)}px`;
  tooltip.style.top = `${Math.max(pad, top)}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

async function renderTimeline(token) {
  setActiveNav('timeline');
  setTitle('Хронология');
  let scholars;
  try {
    ({ scholars } = await api.scholars({ sort: 'chronology' }));
  } catch (err) {
    if (token === renderToken) main.innerHTML = errorView(err.message);
    return;
  }
  if (token !== renderToken) return;

  const bySlug = new Map(scholars.map((s) => [s.slug, s]));

  main.innerHTML = `
    <section class="page-head">
      <h1>Хронология</h1>
      <p class="lead">Годы жизни учёных с VIII по XVI век. Видно, кто был современником, а кто читал книги предшественников спустя столетия.
        Наведите на полосу, чтобы увидеть подробности, нажмите — чтобы открыть рассказ.</p>
    </section>

    <figure class="chart-card">
      <figcaption class="chart-title">Годы жизни, ${TL_START}–${TL_END} гг.<span class="muted"> · у многих даты приблизительны</span></figcaption>
      <div class="timeline">
        <div class="tl-axis" aria-hidden="true">
          <span></span>
          <div class="tl-axis-track">
            ${TL_TICKS.map((t) => `<span class="tick${t % 200 ? ' tick-minor' : ''}" style="left:${pct(t)}%">${t}</span>`).join('')}
          </div>
        </div>
        <div class="tl-rows">
          <div class="tl-grid" aria-hidden="true">
            ${TL_TICKS.map((t) => `<span style="left:${pct(t)}%"></span>`).join('')}
          </div>
          ${scholars
            .map(
              (s) => `<div class="tl-row">
                <a class="tl-label" href="${scholarHref(s.slug)}"><span>${esc(s.name)}</span><small>${esc(s.lifespan)}</small></a>
                <div class="tl-track">
                  <a class="tl-bar" href="${scholarHref(s.slug)}" data-slug="${esc(s.slug)}" tabindex="-1" aria-hidden="true"
                     style="left:${pct(s.bornYear)}%;width:${pct(TL_START + s.diedYear - s.bornYear)}%"></a>
                </div>
              </div>`,
            )
            .join('')}
        </div>
      </div>
    </figure>

    <details class="table-view">
      <summary>Показать таблицей</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th scope="col">Учёный</th><th scope="col">Годы жизни</th><th scope="col">Место рождения</th><th scope="col">Эпоха</th></tr></thead>
          <tbody>
            ${scholars
              .map(
                (s) => `<tr>
                  <th scope="row"><a href="${scholarHref(s.slug)}">${esc(s.name)}</a></th>
                  <td>${esc(s.lifespan)}</td>
                  <td>${esc(s.birthplace)}</td>
                  <td>${esc(eraOf(s.era).label)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </details>`;

  const rows = main.querySelector('.tl-rows');
  rows.addEventListener('pointermove', (event) => {
    const bar = event.target.closest('.tl-bar');
    if (!bar) return hideTooltip();
    const s = bySlug.get(bar.dataset.slug);
    const era = eraOf(s.era);
    showTooltip(
      `<strong>${esc(s.name)}</strong>
       <span>${esc(s.lifespan)}</span>
       <span class="muted">${esc(s.birthplace)}</span>
       <span class="muted">${esc(era.label)}</span>`,
      event.clientX,
      event.clientY,
    );
  });
  rows.addEventListener('pointerleave', hideTooltip);
}

/* ---------- О проекте ---------- */

function renderAbout() {
  setActiveNav('about');
  setTitle('О проекте');
  main.innerHTML = `
    <article class="prose">
      <h1>О проекте</h1>
      <p class="lead">«Дом мудрости» назван в честь Байт аль-Хикма — багдадской библиотеки IX века, где переводили и изучали
        книги со всего известного тогда мира.</p>

      <h2>Откуда тексты</h2>
      <p>Рассказы написаны по общеизвестным историческим сведениям об учёных. Это краткие пересказы, а не цитаты из какой-либо книги.
        Для углублённого чтения рекомендуем книгу Мехмета Байракдара «İslam Bilim Adamları».</p>
      <p>Многие истории об учёных дошли до нас в передаче поздних биографов. Такие рассказы вынесены в отдельный блок
        «Предание или факт?», чтобы их было легко отличить от достоверно известного.</p>

      <h2>Как добавить учёного</h2>
      <p>Все тексты хранятся в файле <code>data/scholars.json</code>. Добавьте новую запись по образцу существующих и перезапустите сервер:
        база данных пересоберётся из файла, а комментарии читателей сохранятся.</p>

      <h2>API</h2>
      <ul class="api-list">
        <li><code>GET /api/meta</code> — области науки и эпохи с количеством учёных</li>
        <li><code>GET /api/scholars?q=&amp;field=&amp;era=&amp;sort=chronology|name</code> — список с поиском и фильтрами</li>
        <li><code>GET /api/scholars/:slug</code> — полный рассказ и соседи по хронологии</li>
        <li><code>GET /api/scholars/:slug/film</code> — сценарий фильма: части, сцены и озвучка</li>
        <li><code>GET /api/scholars/:slug/comments</code> — комментарии</li>
        <li><code>POST /api/scholars/:slug/comments</code> — добавить комментарий: <code>{ "author": "…", "body": "…" }</code></li>
      </ul>
    </article>`;
}

/* ---------- Фильм ---------- */

async function renderFilm(slug, params, token) {
  // The scholar page stays underneath, so closing the film lands on it.
  await renderScholar(slug, token);
  if (token !== renderToken) return;
  const { openFilm } = await import('./film/player.js');
  if (token !== renderToken) return;
  // «?beat=3&p=0.5» shows a still frame of one part, without sound.
  const preview = params.has('beat') ? { beat: Number(params.get('beat')) || 0, p: Number(params.get('p') ?? 0.5) } : null;
  try {
    const film = await openFilm(slug, {
      preview,
      onClose: () => {
        location.hash = `#/scholars/${encodeURIComponent(slug)}`;
      },
    });
    if (token !== renderToken) film.destroy();
    else {
      activeFilm = film;
      setTitle(`Фильм: ${document.title.split(' — ')[0]}`);
    }
  } catch (err) {
    main.insertAdjacentHTML('afterbegin', `<p class="notice">Не удалось открыть фильм: ${esc(err.message)}</p>`);
  }
}

/* ---------- Роутер ---------- */

async function route() {
  const hash = location.hash || '#/';
  // Plain anchors such as the skip link (#main) are not routes.
  if (!hash.startsWith('#/')) return;

  const token = ++renderToken;
  hideTooltip();
  activeFilm?.destroy();
  activeFilm = null;
  const [path, search = ''] = hash.slice(1).split('?');
  const params = new URLSearchParams(search);

  try {
    if (!meta) meta = await api.meta();
  } catch (err) {
    main.innerHTML = errorView(`Не удалось связаться с сервером: ${err.message}`);
    return;
  }
  if (token !== renderToken) return;

  const scholarMatch = path.match(/^\/scholars\/([a-z0-9-]+)$/);
  const filmMatch = path.match(/^\/film\/([a-z0-9-]+)$/);
  if (path === '/' || path === '') renderHome(params, token);
  else if (scholarMatch) await renderScholar(scholarMatch[1], token);
  else if (filmMatch) await renderFilm(filmMatch[1], params, token);
  else if (path === '/timeline') await renderTimeline(token);
  else if (path === '/about') renderAbout();
  else {
    setActiveNav('');
    setTitle('Не найдено');
    main.innerHTML = errorView('Такой страницы нет.');
  }
  if (token === renderToken) window.scrollTo(0, 0);
}

/* ---------- Тема ---------- */

const themeButton = document.querySelector('.theme-toggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme || (prefersDark.matches ? 'dark' : 'light');

function updateThemeButton() {
  const label = currentTheme() === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
}

themeButton.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
  updateThemeButton();
});
prefersDark.addEventListener('change', updateThemeButton);
updateThemeButton();

window.addEventListener('hashchange', route);
route();
