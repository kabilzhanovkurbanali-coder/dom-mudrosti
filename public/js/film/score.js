// Music and sound for the films, synthesized live with Web Audio: a drone,
// string pads, a plucked oud-like line and a frame drum in the Hijaz mode,
// plus a whoosh on cuts and a boom under the title. The narrator's voice is
// routed through the same mix: a warm EQ, gentle compression and a short
// room tail, and the music ducks under it.

const BPM = 76;
const EIGHTH = 60 / BPM / 2;
const BAR = EIGHTH * 8;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// D Hijaz (phrygian dominant) and D major, as semitones above D.
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const ROOT = 50; // D3

// Chords as scale degrees (0-based), two bars each.
const MOODS = {
  epic: { scale: HIJAZ, chords: [[0, 2, 4], [1, 3, 5], [6, 1, 3], [0, 2, 4]], pluck: 0.55, drums: 'maqsum', cutoff: 1500, octave: 0 },
  calm: { scale: HIJAZ, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], pluck: 0.35, drums: 'soft', cutoff: 1100, octave: 0 },
  mystery: { scale: HIJAZ, chords: [[3, 5, 0], [1, 3, 5], [0, 2, 4], [0, 1, 4]], pluck: 0.18, drums: 'none', cutoff: 700, octave: -1 },
  uplift: { scale: MAJOR, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], pluck: 0.45, drums: 'soft', cutoff: 1900, octave: 0 },
};
const MOOD_BY_KIND = { intro: 'epic', story: 'calm', discovery: 'mystery', legend: 'mystery', legacy: 'uplift' };

function noiseBuffer(ac, seconds) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// A large, dark hall: exponentially decaying stereo noise.
function impulse(ac, seconds, decay) {
  const n = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;
      d[i] = lp * (1 - t) ** decay * (i < ac.sampleRate * 0.02 ? i / (ac.sampleRate * 0.02) : 1);
    }
  }
  return buf;
}

// Karplus–Strong plucked string, rendered once per pitch.
function pluckBuffer(ac, freq, seconds = 2.6) {
  const sr = ac.sampleRate;
  const N = Math.max(2, Math.floor(sr / freq - 0.5));
  const line = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
    line[i] = prev;
  }
  const n = Math.floor(sr * seconds);
  const buf = ac.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % N];
    line[idx] = (cur + next) * 0.4985;
    d[i] = cur;
    idx = (idx + 1) % N;
  }
  return { buffer: buf, rate: freq / (sr / (N + 0.5)) };
}

export function createScore() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ac;
  try {
    ac = new AC({ latencyHint: 'playback' });
  } catch {
    return null;
  }

  const master = ac.createGain();
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 4;
  limiter.ratio.value = 10;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ac.destination);

  const reverb = ac.createConvolver();
  reverb.buffer = impulse(ac, 4.2, 2.8);
  const reverbOut = ac.createGain();
  reverbOut.gain.value = 0.8;
  reverb.connect(reverbOut).connect(master);

  const music = ac.createGain();
  music.gain.value = 0;
  music.connect(master);
  const musicVerb = ac.createGain();
  musicVerb.gain.value = 0.6;
  music.connect(musicVerb).connect(reverb);

  const sfx = ac.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);
  const sfxVerb = ac.createGain();
  sfxVerb.gain.value = 0.5;
  sfx.connect(sfxVerb).connect(reverb);

  const noise = noiseBuffer(ac, 2);

  // ---- Drone: detuned saws and a sub, slowly breathing filter.
  const droneFilter = ac.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 420;
  droneFilter.Q.value = 0.7;
  const droneGain = ac.createGain();
  droneGain.gain.value = 0.045;
  droneFilter.connect(droneGain).connect(music);
  const drones = [-6, 5, 0].map((cents, i) => {
    const osc = ac.createOscillator();
    osc.type = i === 2 ? 'sine' : 'sawtooth';
    osc.frequency.value = midi(ROOT - (i === 2 ? 24 : 12));
    osc.detune.value = cents;
    const g = ac.createGain();
    g.gain.value = i === 2 ? 1.4 : 0.5;
    osc.connect(g).connect(droneFilter);
    osc.start();
    return osc;
  });
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(droneFilter.frequency);
  lfo.start();

  // ---- Plucks, pre-rendered for two octaves of both scales.
  const plucks = new Map();
  const pluckFor = (note) => {
    if (!plucks.has(note)) plucks.set(note, pluckBuffer(ac, midi(note)));
    return plucks.get(note);
  };

  let mood = MOODS.calm;
  let nextMood = mood;
  let step = 0;
  let nextTime = 0;
  let chord = mood.chords[0];
  let timer = 0;
  let started = false;
  let voiceOn = false;
  let level = 0;

  const noteOf = (degree, octave = 0) => {
    const s = mood.scale;
    const o = Math.floor(degree / s.length);
    return ROOT + s[((degree % s.length) + s.length) % s.length] + 12 * (o + octave + mood.octave);
  };

  function pad(time, notes, length) {
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood.cutoff;
    filter.Q.value = 0.5;
    const env = ac.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.022, time + 2.2);
    env.gain.setValueAtTime(0.022, time + length - 0.2);
    env.gain.linearRampToValueAtTime(0, time + length + 2.8);
    filter.connect(env).connect(music);
    for (const n of notes) {
      for (const cents of [-7, 7]) {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(n);
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + length + 3);
      }
    }
  }

  function pluck(time, note, gain = 0.16) {
    const { buffer, rate } = pluckFor(note);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const body = ac.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 900;
    body.gain.value = 4;
    const g = ac.createGain();
    g.gain.value = gain;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 0.8 - 0.4;
    src.connect(body).connect(g);
    (pan ? g.connect(pan) : g).connect(music);
    src.start(time);
  }

  function drum(time, kind, gain = 1) {
    if (kind === 'doum') {
      const osc = ac.createOscillator();
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.exponentialRampToValueAtTime(48, time + 0.25);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.42 * gain, time + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
      osc.connect(g).connect(music);
      osc.start(time);
      osc.stop(time + 0.6);
    }
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = kind === 'doum' ? 'lowpass' : 'bandpass';
    f.frequency.value = kind === 'doum' ? 400 : 2600;
    f.Q.value = kind === 'doum' ? 0.7 : 1.4;
    const g = ac.createGain();
    const peak = (kind === 'doum' ? 0.18 : 0.09) * gain;
    g.gain.setValueAtTime(peak, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + (kind === 'doum' ? 0.18 : 0.07));
    src.connect(f).connect(g).connect(music);
    src.start(time, Math.random() * 1.5);
    src.stop(time + 0.25);
  }

  // Maqsum: D T . T D . T .
  const MAQSUM = ['doum', 'tek', null, 'tek', 'doum', null, 'tek', null];

  function scheduleStep(time) {
    const inBar = step % 8;
    const bar = Math.floor(step / 8);
    if (inBar === 0 && bar % 2 === 0) {
      mood = nextMood;
      chord = mood.chords[(bar / 2) % mood.chords.length];
      pad(time, chord.map((d) => noteOf(d, 0)), BAR * 2);
      const root = noteOf(chord[0], -1);
      for (const [i, osc] of drones.entries()) {
        osc.frequency.setTargetAtTime(midi(root - (i === 2 ? 12 : 0)), time, 1.2);
      }
      droneFilter.frequency.setTargetAtTime(mood.cutoff * 0.4, time, 2);
    }
    // Oud line: chord tones on strong steps, passing notes in between.
    if (Math.random() < mood.pluck * (inBar % 2 === 0 ? 1 : 0.55)) {
      const degree = inBar % 2 === 0 ? chord[Math.floor(Math.random() * 3)] : chord[0] + Math.floor(Math.random() * 7);
      pluck(time, noteOf(degree, Math.random() < 0.3 ? 1 : 0), voiceOn ? 0.11 : 0.16);
    }
    if (mood.drums === 'maqsum' && MAQSUM[inBar]) drum(time, MAQSUM[inBar], 1);
    else if (mood.drums === 'soft' && inBar === 0 && bar % 2 === 0) drum(time, 'doum', 0.55);
    step += 1;
  }

  function tick() {
    while (nextTime < ac.currentTime + 0.25) {
      scheduleStep(nextTime);
      nextTime += EIGHTH;
    }
  }

  function setLevel() {
    const target = started ? (voiceOn ? 0.5 : 0.95) : 0;
    if (target === level) return;
    level = target;
    music.gain.setTargetAtTime(target, ac.currentTime, voiceOn ? 0.25 : 0.8);
  }

  // ---- Voice chain.
  let voiceSource = null;
  function connectVoice(element) {
    if (voiceSource) return true;
    try {
      voiceSource = ac.createMediaElementSource(element);
    } catch {
      return false;
    }
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 75;
    const warmth = ac.createBiquadFilter();
    warmth.type = 'lowshelf';
    warmth.frequency.value = 200;
    warmth.gain.value = 2.5;
    const presence = ac.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 0.9;
    presence.gain.value = 1.5;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.18;
    const out = ac.createGain();
    out.gain.value = 1.35;
    const room = ac.createGain();
    room.gain.value = 0.06;
    voiceSource.connect(hp).connect(warmth).connect(presence).connect(comp).connect(out).connect(master);
    out.connect(room).connect(reverb);
    return true;
  }

  return {
    context: ac,
    connectVoice,

    start() {
      if (started) return;
      started = true;
      ac.resume?.();
      nextTime = ac.currentTime + 0.1;
      clearInterval(timer);
      tick();
      timer = setInterval(tick, 60);
      setLevel();
    },

    setMood(kind) {
      nextMood = MOODS[MOOD_BY_KIND[kind] ?? 'calm'];
    },

    voice(active) {
      voiceOn = active;
      setLevel();
    },

    // One-shot sounds: 'cut' (soft whoosh), 'title' (deep boom), 'fact' (shimmer).
    hit(kind) {
      if (!started) return;
      const t = ac.currentTime + 0.02;
      if (kind === 'cut' || kind === 'title') {
        const src = ac.createBufferSource();
        src.buffer = noise;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2.2;
        f.frequency.setValueAtTime(260, t);
        f.frequency.exponentialRampToValueAtTime(kind === 'title' ? 1800 : 2600, t + 0.55);
        f.frequency.exponentialRampToValueAtTime(400, t + 1.1);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === 'title' ? 0.16 : 0.07, t + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
        src.connect(f).connect(g).connect(sfx);
        src.start(t, Math.random());
        src.stop(t + 1.2);
      }
      if (kind === 'title') {
        const osc = ac.createOscillator();
        osc.frequency.setValueAtTime(62, t + 0.4);
        osc.frequency.exponentialRampToValueAtTime(31, t + 2.4);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.55, t + 0.43);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        osc.connect(g).connect(sfx);
        osc.start(t + 0.4);
        osc.stop(t + 3);
        drum(t + 0.4, 'doum', 1.4);
      }
      if (kind === 'fact') {
        [2349, 3136, 3951, 4699].forEach((f, i) => {
          const osc = ac.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const g = ac.createGain();
          const at = t + i * 0.06;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.025, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
          osc.connect(g).connect(sfx);
          osc.start(at);
          osc.stop(at + 2.3);
        });
      }
    },

    pause() {
      ac.suspend?.();
    },
    resume() {
      ac.resume?.();
    },
    setMuted(value) {
      master.gain.setTargetAtTime(value ? 0 : 1, ac.currentTime, 0.05);
    },
    // Fades the music out at the end of the film.
    end() {
      started = false;
      setLevel();
    },
    destroy() {
      clearInterval(timer);
      ac.close?.();
    },
  };
}
