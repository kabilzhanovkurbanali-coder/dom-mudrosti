import express from 'express';
import { fileURLToPath } from 'node:url';
import { normalize } from './db.js';
import { buildFilms } from './film.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const THREE_DIR = fileURLToPath(new URL('../node_modules/three/build', import.meta.url));

const AUTHOR_MAX = 60;
const BODY_MAX = 2000;
const QUERY_MAX = 100;

const collator = new Intl.Collator('ru');
// «Аль-Хорезми» sorts under «Х», as in Russian encyclopedias.
const sortKey = (name) => name.replace(/^(аль|ар|аз|ат|ан|ас)-/i, '');

function summaryOf(s) {
  const { slug, name, fullName, latinName, lifespan, bornYear, diedYear, birthplace, era, fields, summary } = s;
  return { slug, name, fullName, latinName, lifespan, bornYear, diedYear, birthplace, era, fields, summary };
}

// Strips control characters (keeping line breaks) and trims.
function cleanText(value, { multiline }) {
  if (typeof value !== 'string') return '';
  const text = value.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  return multiline
    ? text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : text.replace(/\s+/g, ' ').trim();
}

function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (now - times[times.length - 1] >= windowMs) hits.delete(k);
      }
    }
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const allowed = recent.length < max;
    if (allowed) recent.push(now);
    hits.set(key, recent);
    return allowed;
  };
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function createApp({
  db,
  content,
  filmScripts = {},
  filmMedia = {},
  narrator = null,
  commentLimit = { max: 5, windowMs: 10 * 60 * 1000 },
}) {
  const app = express();
  app.disable('x-powered-by');

  const fieldIds = new Set(content.fields.map((f) => f.id));
  const eraIds = new Set(content.eras.map((e) => e.id));
  const allowComment = rateLimiter(commentLimit);
  const films = buildFilms(content, filmScripts, narrator, filmMedia);

  const stmt = {
    bySlug: db.prepare('SELECT data FROM scholars WHERE slug = ?'),
    chronology: db.prepare('SELECT slug, data FROM scholars ORDER BY born_year, slug'),
    fieldCounts: db.prepare('SELECT field, COUNT(*) AS count FROM scholar_fields GROUP BY field'),
    eraCounts: db.prepare('SELECT era, COUNT(*) AS count FROM scholars GROUP BY era'),
    comments: db.prepare(
      'SELECT id, author, body, created_at AS createdAt FROM comments WHERE slug = ? ORDER BY id DESC LIMIT 200',
    ),
    commentCount: db.prepare('SELECT COUNT(*) AS count FROM comments WHERE slug = ?'),
    insertComment: db.prepare(
      'INSERT INTO comments (slug, author, body) VALUES (?, ?, ?) RETURNING id, author, body, created_at AS createdAt',
    ),
  };

  const findScholar = (slug) => {
    const row = stmt.bySlug.get(slug);
    return row ? JSON.parse(row.data) : null;
  };

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '10kb' }));

  api.get('/meta', (req, res) => {
    const fieldCounts = Object.fromEntries(stmt.fieldCounts.all().map((r) => [r.field, r.count]));
    const eraCounts = Object.fromEntries(stmt.eraCounts.all().map((r) => [r.era, r.count]));
    res.json({
      total: content.scholars.length,
      fields: content.fields.map((f) => ({ ...f, count: fieldCounts[f.id] ?? 0 })),
      eras: content.eras.map((e) => ({ ...e, count: eraCounts[e.id] ?? 0 })),
    });
  });

  api.get('/scholars', (req, res) => {
    const { field = '', era = '', sort = 'chronology' } = req.query;
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, QUERY_MAX) : '';

    if (field && !fieldIds.has(field)) return res.status(400).json({ error: 'Неизвестная область науки' });
    if (era && !eraIds.has(era)) return res.status(400).json({ error: 'Неизвестная эпоха' });
    if (!['chronology', 'name'].includes(sort)) return res.status(400).json({ error: 'Неизвестная сортировка' });

    const where = [];
    const params = [];
    if (field) {
      where.push('EXISTS (SELECT 1 FROM scholar_fields f WHERE f.slug = s.slug AND f.field = ?)');
      params.push(field);
    }
    if (era) {
      where.push('s.era = ?');
      params.push(era);
    }
    for (const term of normalize(q).split(/\s+/).filter(Boolean)) {
      where.push('instr(s.search_text, ?) > 0');
      params.push(term);
    }

    const sql = `SELECT s.data FROM scholars s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.born_year, s.slug`;
    let scholars = db.prepare(sql).all(...params).map((r) => summaryOf(JSON.parse(r.data)));
    if (sort === 'name') {
      scholars = scholars.sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)));
    }
    res.json({ count: scholars.length, scholars });
  });

  api.get('/scholars/:slug', (req, res) => {
    const order = stmt.chronology.all();
    const index = order.findIndex((r) => r.slug === req.params.slug);
    if (index === -1) return res.status(404).json({ error: 'Учёный не найден' });

    const neighbour = (i) => {
      if (i < 0 || i >= order.length) return null;
      const { slug, name, lifespan } = JSON.parse(order[i].data);
      return { slug, name, lifespan };
    };
    res.json({
      scholar: JSON.parse(order[index].data),
      commentCount: stmt.commentCount.get(req.params.slug).count,
      prev: neighbour(index - 1),
      next: neighbour(index + 1),
    });
  });

  api.get('/scholars/:slug/film', (req, res) => {
    const film = films.get(req.params.slug);
    if (!film) return res.status(404).json({ error: 'Учёный не найден' });
    res.json(film());
  });

  api.get('/narration/:file', async (req, res) => {
    const [, id, ext] = /^([a-f0-9]{20})\.(mp3|m4a|json)$/.exec(req.params.file) ?? [];
    if (!id || !narrator?.has(id)) return res.status(404).json({ error: 'Нет такой озвучки' });
    const timings = ext === 'json';
    if (timings ? !narrator.timings : ext !== narrator.ext) return res.status(404).json({ error: 'Нет такой озвучки' });
    let file;
    try {
      file = await (timings ? narrator.timingsFile(id) : narrator.file(id));
    } catch (error) {
      console.error(`Озвучка ${id}: ${error.message}`);
    }
    if (!file) return res.status(503).json({ error: 'Голос рассказчика недоступен на этом сервере' });
    // The id is a hash of the text and the voice, so a cached file never changes.
    res.sendFile(file, {
      headers: { 'Content-Type': timings ? 'application/json; charset=utf-8' : narrator.contentType ?? 'audio/mp4' },
      maxAge: '365d',
      immutable: true,
    });
  });

  api.get('/scholars/:slug/comments', (req, res) => {
    if (!findScholar(req.params.slug)) return res.status(404).json({ error: 'Учёный не найден' });
    res.json({ comments: stmt.comments.all(req.params.slug) });
  });

  api.post('/scholars/:slug/comments', (req, res) => {
    if (!findScholar(req.params.slug)) return res.status(404).json({ error: 'Учёный не найден' });

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    // Hidden «website» field: people never see it, bots fill it in.
    if (payload.website) return res.status(400).json({ error: 'Комментарий отклонён' });

    const author = cleanText(payload.author, { multiline: false });
    const body = cleanText(payload.body, { multiline: true });
    const errors = {};
    if (author.length < 2 || author.length > AUTHOR_MAX) errors.author = `Имя — от 2 до ${AUTHOR_MAX} символов`;
    if (body.length < 3 || body.length > BODY_MAX) errors.body = `Комментарий — от 3 до ${BODY_MAX} символов`;
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Проверьте форму', fields: errors });

    if (!allowComment(req.ip)) {
      return res.status(429).json({ error: 'Слишком много комментариев подряд. Попробуйте через несколько минут.' });
    }

    const comment = stmt.insertComment.get(req.params.slug, author, body);
    res.status(201).json({ comment });
  });

  api.use((req, res) => res.status(404).json({ error: 'Нет такого адреса API' }));

  app.use('/api', api);
  app.use('/vendor/three', express.static(THREE_DIR, { maxAge: '7d' }));
  app.use(express.static(PUBLIC_DIR));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой запрос' });
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}
