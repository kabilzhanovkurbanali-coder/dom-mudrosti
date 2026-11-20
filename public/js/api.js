async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Ошибка сервера (${res.status})`);
    err.status = res.status;
    err.fields = data.fields ?? {};
    throw err;
  }
  return data;
}

function query(params) {
  const clean = Object.entries(params).filter(([, v]) => v !== '' && v != null);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
}

const scholarPath = (slug) => `/scholars/${encodeURIComponent(slug)}`;

// The static copy of the site (tools/build-static.mjs) has no server: the
// answers are JSON files, and search and filters run here, like on the server.
export const isStatic = document.documentElement.dataset.static === '1';

async function staticJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    const err = new Error(res.status === 404 ? 'Учёный не найден' : `Ошибка загрузки (${res.status})`);
    err.status = res.status;
    err.fields = {};
    throw err;
  }
  return res.json();
}

const normalize = (text) => String(text ?? '').toLowerCase().replaceAll('ё', 'е');
const collator = new Intl.Collator('ru');
const sortKey = (name) => name.replace(/^(аль|ар|аз|ат|ан|ас)-/i, '');
let staticIndex = null;

async function staticScholars({ q = '', field = '', era = '', sort = 'chronology' } = {}) {
  staticIndex ??= staticJson('/api/scholars.json');
  const { scholars: all } = await staticIndex;
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  let list = all.filter(
    (s) => (!field || s.fields.includes(field)) && (!era || s.era === era) && terms.every((t) => s.search.includes(t)),
  );
  if (sort === 'name') list = [...list].sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)));
  const scholars = list.map(({ search, ...summary }) => summary);
  return { count: scholars.length, scholars };
}

const staticApi = {
  meta: () => staticJson('/api/meta.json'),
  scholars: staticScholars,
  scholar: (slug) => staticJson(`/api/scholars/${encodeURIComponent(slug)}.json`),
  film: (slug) => staticJson(`/api/films/${encodeURIComponent(slug)}.json`),
  comments: async () => ({ comments: [] }),
  addComment: async () => {
    const err = new Error('Обсуждение работает только в полной версии сайта с сервером.');
    err.status = 403;
    err.fields = {};
    throw err;
  },
};

export const api = isStatic ? staticApi : {
  meta: () => request('/meta'),
  scholars: (params = {}) => request(`/scholars${query(params)}`),
  scholar: (slug) => request(scholarPath(slug)),
  film: (slug) => request(`${scholarPath(slug)}/film`),
  comments: (slug) => request(`${scholarPath(slug)}/comments`),
  addComment: (slug, payload) => request(`${scholarPath(slug)}/comments`, { method: 'POST', body: payload }),
};
