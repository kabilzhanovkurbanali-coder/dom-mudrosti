import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadContent, loadFilmMedia, loadFilmScripts } from './content.js';
import { openDatabase } from './db.js';
import { createNarrator } from './narration.js';

const content = loadContent();
const filmScripts = loadFilmScripts(content);
const filmMedia = loadFilmMedia(content);
const dbFile = process.env.DB_FILE ?? fileURLToPath(new URL('../data/site.db', import.meta.url));
const db = openDatabase(dbFile, content);
const narrator = await createNarrator({ dir: fileURLToPath(new URL('../data/audio', import.meta.url)) });
const app = createApp({ db, content, filmScripts, filmMedia, narrator });

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`«Дом мудрости» запущен: http://localhost:${port}`);
  console.log(
    narrator.available
      ? `Голос рассказчика: ${narrator.voice} (${narrator.engine === 'edge' ? 'нейроголос edge-tts' : 'голос macOS'})`
      : 'Голос рассказчика недоступен — фильмы прочитает голос браузера (кроме уже озвученных частей)',
  );
});
