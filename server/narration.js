import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TTS_SCRIPT = path.join(ROOT, 'tools', 'tts.py');

// Two voices are supported:
// - edge: Microsoft neural voices through edge-tts (natural, with word timings
//   for the subtitles). Needs Python with edge-tts and the network on first use.
// - say: the built-in macOS voice, as before. No timings.
// Files are cached in `dir`, so a voiced text never needs the network again.
// Only texts registered from the films can be voiced, so the endpoint
// cannot be used to synthesize arbitrary text.
const ENGINES = {
  edge: { ext: 'mp3', contentType: 'audio/mpeg', timings: true, voice: 'ru-RU-SvetlanaNeural' },
  say: { ext: 'm4a', contentType: 'audio/mp4', timings: false, voice: 'Milena' },
};

function findPython() {
  if (process.env.NARRATOR_PYTHON) return process.env.NARRATOR_PYTHON;
  const venv = path.join(ROOT, '.venv', 'bin', 'python');
  return existsSync(venv) ? venv : 'python3';
}

async function edgeAvailable(python) {
  try {
    await run(python, ['-c', 'import edge_tts'], { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function sayAvailable(voice) {
  if (process.platform !== 'darwin') return false;
  try {
    const { stdout } = await run('say', ['-v', '?']);
    return stdout.split('\n').some((line) => line.startsWith(`${voice} `));
  } catch {
    return false;
  }
}

function runWithInput(command, args, input, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    // A stalled network connection must not hang the request forever.
    const timer = setTimeout(() => {
      stderr = `голос не ответил за ${timeoutMs / 1000} с`;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').at(-1) || `exit ${code}`));
    });
    child.stdin.end(input);
  });
}

export async function createNarrator({
  dir,
  engine = process.env.NARRATOR_ENGINE ?? 'auto',
  voice = process.env.NARRATOR_VOICE,
  rate = process.env.NARRATOR_RATE,
  pitch = process.env.NARRATOR_PITCH,
} = {}) {
  const python = findPython();
  let chosen = null;
  if ((engine === 'auto' || engine === 'edge') && (await edgeAvailable(python))) chosen = 'edge';
  else if ((engine === 'auto' || engine === 'say') && (await sayAvailable(voice ?? ENGINES.say.voice))) chosen = 'say';

  const spec = ENGINES[chosen ?? 'edge'];
  const settings = {
    voice: voice ?? spec.voice,
    rate: rate ?? (chosen === 'say' ? '172' : '+0%'),
    pitch: pitch ?? '+0Hz',
  };

  const texts = new Map();
  const pending = new Map();

  async function synthesize(id) {
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, `${id}.${spec.ext}`);
    const tmp = `${target}.${process.pid}.tmp.${spec.ext}`;
    const tmpTimings = `${tmp}.json`;
    try {
      if (chosen === 'edge') {
        await runWithInput(
          python,
          [TTS_SCRIPT, '--voice', settings.voice, '--rate', settings.rate, '--pitch', settings.pitch, '--out', tmp, '--timings', tmpTimings],
          texts.get(id),
        );
        await rename(tmpTimings, path.join(dir, `${id}.json`));
      } else {
        await run('say', ['-v', settings.voice, '-r', settings.rate, '--file-format=m4af', '--data-format=aac', '-o', tmp, texts.get(id)]);
      }
      await rename(tmp, target);
    } finally {
      await rm(tmp, { force: true });
      await rm(tmpTimings, { force: true });
    }
  }

  // Returns the cached file, synthesizing the text once if needed.
  async function ensure(id, ext) {
    if (!texts.has(id)) return null;
    const target = path.join(dir, `${id}.${ext}`);
    try {
      await access(target);
      return target;
    } catch {
      // Not cached yet.
    }
    if (!chosen) return null;
    if (!pending.has(id)) pending.set(id, synthesize(id).finally(() => pending.delete(id)));
    await pending.get(id);
    return target;
  }

  return {
    available: chosen !== null,
    engine: chosen,
    voice: chosen ? settings.voice : null,
    ext: spec.ext,
    contentType: spec.contentType,
    timings: spec.timings,

    register(text) {
      // Without any voice the ids still match files voiced elsewhere
      // (for example, on a Mac before deploying), so those can be served.
      const key = `${chosen ?? 'edge'}|${settings.voice}|${settings.rate}|${settings.pitch}|${text}`;
      const id = createHash('sha1').update(key).digest('hex').slice(0, 20);
      texts.set(id, text);
      return id;
    },

    has: (id) => texts.has(id),
    // Can this text be played: either voiced already or voiceable here.
    playable: (id) => chosen !== null || existsSync(path.join(dir, `${id}.${spec.ext}`)),
    file: (id) => ensure(id, spec.ext),
    timingsFile: (id) => (spec.timings ? ensure(id, 'json') : Promise.resolve(null)),
    ids: () => [...texts.keys()],
  };
}
