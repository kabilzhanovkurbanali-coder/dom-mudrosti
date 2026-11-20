import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Lower-cases and folds «ё» so search ignores case and that letter.
// SQLite's own lower() only handles ASCII, so all search text is normalized here.
export function normalize(text) {
  return String(text ?? '').toLowerCase().replaceAll('ё', 'е');
}

function searchText(s) {
  return normalize([
    s.name,
    s.fullName,
    s.latinName,
    s.birthplace,
    ...s.places,
    s.summary,
    s.story.title,
    ...s.story.paragraphs,
    s.legend?.title,
    s.legend?.text,
    ...s.works.map((w) => `${w.title} ${w.note}`),
    ...s.contributions,
    s.legacy,
  ].join(' '));
}

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS scholars (
    slug        TEXT PRIMARY KEY,
    born_year   INTEGER NOT NULL,
    era         TEXT NOT NULL,
    search_text TEXT NOT NULL,
    data        TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scholar_fields (
    slug  TEXT NOT NULL REFERENCES scholars(slug) ON DELETE CASCADE,
    field TEXT NOT NULL,
    PRIMARY KEY (slug, field)
  );
  -- Comments are keyed by slug without a foreign key, so re-seeding
  -- the scholars from JSON never deletes what readers have written.
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS comments_by_slug ON comments(slug, id);
`;

// The JSON file is the source of truth for the stories; the database
// is rebuilt from it on every start and also stores readers' comments.
function seed(db, content) {
  const insertScholar = db.prepare(
    'INSERT INTO scholars (slug, born_year, era, search_text, data) VALUES (?, ?, ?, ?, ?)',
  );
  const insertField = db.prepare('INSERT INTO scholar_fields (slug, field) VALUES (?, ?)');

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM scholars');
    for (const s of content.scholars) {
      insertScholar.run(s.slug, s.bornYear, s.era, searchText(s), JSON.stringify(s));
      for (const field of s.fields) insertField.run(s.slug, field);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function openDatabase(file, content) {
  if (file !== ':memory:') {
    mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  seed(db, content);
  return db;
}
