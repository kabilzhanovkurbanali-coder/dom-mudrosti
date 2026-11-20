// Pre-generates the narration for every film, so the first viewing
// never waits for the voice. Run with `npm run narration`.
import { fileURLToPath } from 'node:url';
import { buildFilms } from './film.js';
import { loadContent, loadFilmMedia, loadFilmScripts } from './content.js';
import { createNarrator } from './narration.js';

const content = loadContent();
const narrator = await createNarrator({ dir: fileURLToPath(new URL('../data/audio', import.meta.url)) });

if (!narrator.available) {
  console.error(
    'Голос недоступен. Установите нейроголос: npm run setup (нужен Python 3), ' +
      'или запустите на Mac со встроенным голосом: NARRATOR_ENGINE=say npm run narration',
  );
  process.exit(1);
}

console.log(`Голос: ${narrator.voice} (${narrator.engine})`);
buildFilms(content, loadFilmScripts(content), narrator, loadFilmMedia(content));
const ids = narrator.ids();
let done = 0;
let failed = 0;
const queue = [...ids];
// A few texts at once: the neural voice is a network service.
await Promise.all(
  Array.from({ length: narrator.engine === 'edge' ? 4 : 1 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await narrator.file(id);
      } catch (error) {
        failed += 1;
        console.error(`\n${id}: ${error.message}`);
      }
      done += 1;
      process.stdout.write(`\rОзвучено ${done - failed} из ${ids.length}`);
    }
  }),
);
process.stdout.write('\n');
if (failed) {
  console.error(`Не удалось озвучить ${failed} частей — запустите команду ещё раз.`);
  process.exit(1);
}
