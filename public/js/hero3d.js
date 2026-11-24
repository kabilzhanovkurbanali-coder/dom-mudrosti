// The title screen in 3D: a golden astrolabe — the instrument of the
// astronomers of the House of Wisdom — turning slowly under the night sky,
// with the planets on their orbits and the formulas of their discoveries
// drifting in the dark. It follows the mouse and tilts as the page scrolls.
import { THREE, rng, glow, label, SERIF } from './film/kit.js';
import { createPost } from './film/post.js';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arabic = (n) => String(n).split('').map((d) => ARABIC_DIGITS[Number(d)]).join('');

// A warm room for the reflections of the brass.
function environment(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#fff3dc');
  sky.addColorStop(0.4, '#c49a5c');
  sky.addColorStop(0.55, '#3a2814');
  sky.addColorStop(1, '#07090e');
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#fffaf0';
  for (const [x, y, w, h] of [[70, 40, 50, 70], [260, 30, 26, 80], [400, 50, 60, 50]]) g.fillRect(x, y, w, h);
  g.fillStyle = '#9fc3ff';
  g.fillRect(180, 120, 90, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

// The engraved face of the astrolabe: degree scale with Arabic numerals,
// the tropics and the equator, almucantars and azimuths, the hour lines.
function faceTexture(size = 2048) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  g.translate(R, R);
  const base = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R);
  base.addColorStop(0, '#e9c46e');
  base.addColorStop(0.6, '#c39343');
  base.addColorStop(1, '#7a5422');
  g.fillStyle = base;
  g.fillRect(-R, -R, size, size);
  // Brushed metal: fine concentric rings.
  for (let r = 6; r < R; r += 3) {
    g.strokeStyle = `rgba(${r % 2 ? '255,240,200' : '60,35,10'},0.035)`;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  const ink = 'rgba(52,30,8,0.85)';
  const shine = 'rgba(255,236,190,0.55)';
  // Engraving: a dark line with a light edge below it.
  const engrave = (draw, width = 3) => {
    g.lineWidth = width;
    g.save();
    g.translate(1.5, 1.5);
    g.strokeStyle = shine;
    draw();
    g.restore();
    g.strokeStyle = ink;
    draw();
  };
  const circle = (r, x = 0, y = 0, a0 = 0, a1 = Math.PI * 2) => () => {
    g.beginPath();
    g.arc(x, y, r, a0, a1);
    g.stroke();
  };
  // Outer limb with the degree scale.
  engrave(circle(R * 0.985), 6);
  engrave(circle(R * 0.9), 4);
  engrave(circle(R * 0.84), 3);
  for (let d = 0; d < 360; d += 1) {
    const a = (d / 360) * Math.PI * 2 - Math.PI / 2;
    const len = d % 10 === 0 ? 0.06 : d % 5 === 0 ? 0.04 : 0.022;
    engrave(() => {
      g.beginPath();
      g.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
      g.lineTo(Math.cos(a) * R * (0.9 + len), Math.sin(a) * R * (0.9 + len));
      g.stroke();
    }, d % 10 === 0 ? 3 : 1.5);
  }
  g.fillStyle = ink;
  g.font = `600 ${Math.round(R * 0.045)}px 'Geeza Pro', 'Noto Naskh Arabic', serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let d = 10; d <= 360; d += 10) {
    const a = (d / 360) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.rotate(a + Math.PI / 2);
    g.fillText(arabic(d), 0, -R * 0.87);
    g.restore();
  }
  // Plate: tropic of Capricorn, equator, tropic of Cancer.
  const cap = R * 0.8;
  engrave(circle(cap), 4);
  engrave(circle(cap * 0.66), 3);
  engrave(circle(cap * 0.435), 3);
  // Almucantars (circles of equal altitude), seen in the stereographic projection.
  const zen = -cap * 0.32;
  for (let k = 0; k <= 9; k++) {
    const rr = cap * (0.95 - k * 0.095);
    const cy = zen + (cap * 0.36 - zen) * (k / 12) * 0.55 + k * cap * 0.006;
    g.save();
    g.beginPath();
    g.arc(0, 0, cap, 0, Math.PI * 2);
    g.clip();
    engrave(circle(rr * (1 - k * 0.012), 0, cy * (1 - k * 0.08) - k * cap * 0.012), k === 0 ? 4 : 2);
    g.restore();
  }
  // Azimuth lines from the zenith.
  g.save();
  g.beginPath();
  g.arc(0, 0, cap, Math.PI, Math.PI * 2);
  g.clip();
  for (let k = -6; k <= 6; k++) {
    if (!k) continue;
    engrave(circle(Math.abs(cap * 1.6 / k), (cap * 1.6) / k, zen - cap * 0.12), 1.6);
  }
  g.restore();
  // Unequal hours below the horizon.
  g.save();
  g.beginPath();
  g.arc(0, 0, cap, 0, Math.PI);
  g.clip();
  for (let k = 1; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    engrave(() => {
      g.beginPath();
      g.moveTo(0, cap * 0.2);
      g.quadraticCurveTo(Math.cos(a) * cap * 0.6, cap * 0.35 + Math.sin(a) * cap * 0.2, Math.cos(a) * cap, Math.sin(a) * cap);
      g.stroke();
    }, 1.4);
  }
  g.restore();
  // Horizon and meridian.
  engrave(() => {
    g.beginPath();
    g.moveTo(-cap, 0);
    g.lineTo(cap, 0);
    g.moveTo(0, -cap);
    g.lineTo(0, cap);
    g.stroke();
  }, 2.5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function astrolabe(envMap) {
  const group = new THREE.Group();
  const R = 3;
  const brass = new THREE.MeshStandardMaterial({ color: 0xb0843c, metalness: 1, roughness: 0.34, envMap, envMapIntensity: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe2b45a, metalness: 1, roughness: 0.22, envMap, envMapIntensity: 1.15, emissive: 0x2a1800, emissiveIntensity: 0.2 });
  // The mater: body, raised rim and the engraved face.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.22, 128), brass);
  body.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 24, 160), brass);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.04, 128),
    new THREE.MeshStandardMaterial({ map: faceTexture(), metalness: 0.75, roughness: 0.48, envMap, envMapIntensity: 0.7, color: 0xd8c4a0 }),
  );
  face.position.z = 0.115;
  group.add(body, rim, face);
  // The throne (kursi) and the shackle on top.
  const kursi = new THREE.Shape();
  kursi.moveTo(-0.9, 0);
  kursi.bezierCurveTo(-0.9, 0.35, -0.55, 0.3, -0.45, 0.62);
  kursi.bezierCurveTo(-0.35, 0.9, -0.12, 0.85, 0, 1.05);
  kursi.bezierCurveTo(0.12, 0.85, 0.35, 0.9, 0.45, 0.62);
  kursi.bezierCurveTo(0.55, 0.3, 0.9, 0.35, 0.9, 0);
  kursi.lineTo(-0.9, 0);
  const hole = new THREE.Path();
  hole.absarc(0, 0.5, 0.18, 0, Math.PI * 2, true);
  kursi.holes.push(hole);
  const throne = new THREE.Mesh(new THREE.ExtrudeGeometry(kursi, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), brass);
  throne.position.set(0, R - 0.12, -0.08);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 16, 40), gold);
  shackle.position.set(0, R + 1.12, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 16, 60), gold);
  ring.position.set(0, R + 1.6, 0);
  ring.rotation.y = Math.PI / 2;
  group.add(throne, shackle, ring);

  // The rete: an openwork star map turning over the face.
  const rete = new THREE.Group();
  rete.position.z = 0.2;
  const tor = (r, tube, x = 0, y = 0, arc = Math.PI * 2) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 160, arc), gold);
    m.position.set(x, y, 0);
    rete.add(m);
    return m;
  };
  const cap = (R - 0.04) * 0.8;
  tor(cap, 0.035);
  // The ecliptic: an eccentric circle with the zodiac.
  tor(cap * 0.56, 0.06, 0, cap * 0.24);
  tor(cap * 0.5, 0.02, 0, cap * 0.24);
  const bar = (a, b, w = 0.05) => {
    const d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, 0.04), gold);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.rotation.z = Math.atan2(d.y, d.x);
    rete.add(m);
  };
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) bar(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * cap, Math.sin(a) * cap, 0));
  // Filigree scrolls.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    const m = tor(0.32, 0.022, Math.cos(a) * cap * 0.72, Math.sin(a) * cap * 0.72, Math.PI * 1.3);
    m.rotation.z = a + Math.PI;
  }
  // Star pointers: flames with a bright point at the tip.
  const rand = rng(12);
  const tips = [];
  for (let k = 0; k < 14; k++) {
    const a = rand() * Math.PI * 2;
    const r = cap * (0.3 + rand() * 0.62);
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 10), gold);
    pointer.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    pointer.rotation.z = a - Math.PI / 2 + (rand() - 0.5) * 0.6;
    rete.add(pointer);
    const tip = glow(0xffe6a8, 0.38, 0.9);
    tip.position.copy(pointer.position).add(new THREE.Vector3(Math.cos(pointer.rotation.z + Math.PI / 2) * 0.22, Math.sin(pointer.rotation.z + Math.PI / 2) * 0.22, 0.05));
    rete.add(tip);
    tips.push({ tip, phase: rand() * 6.28 });
  }
  group.add(rete);
  // The rule (alidade) and the pin.
  const rule = new THREE.Group();
  rule.position.z = 0.3;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(R * 1.94, 0.14, 0.05), brass);
  rule.add(blade);
  for (const s of [-1, 1]) {
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), brass);
    vane.position.set(s * R * 0.85, 0, 0.16);
    rule.add(vane);
  }
  group.add(rule);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 24), gold);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.2;
  const pinCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), gold);
  pinCap.position.z = 0.55;
  group.add(pin, pinCap);
  return { group, rete, rule, tips, R };
}

// Stars that twinkle, a band of the Milky Way.
function sky(count) {
  const rand = rng(5);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const tints = [new THREE.Color(0xffffff), new THREE.Color(0xffe2b0), new THREE.Color(0xbcd4ff), new THREE.Color(0xffc48a)];
  for (let i = 0; i < count; i++) {
    // More stars along a tilted band.
    const band = rand() < 0.45;
    const u = rand() * Math.PI * 2;
    const v = band ? (rand() - 0.5) * 0.35 : Math.acos(2 * rand() - 1) - Math.PI / 2;
    const r = 120 + rand() * 60;
    const p = new THREE.Vector3(Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)).multiplyScalar(r);
    p.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.5);
    pos.set([p.x, p.y, -Math.abs(p.z) - 20], i * 3);
    const c = tints[Math.floor(rand() * tints.length)];
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = (rand() ** 3) * 3.2 + 0.6;
    phase[i] = rand() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float phase;
      attribute vec3 color;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.65 + 0.35 * sin(uTime * (1.0 + fract(phase) * 2.0) + phase * 7.0);
        vColor = color * twinkle;
        gl_PointSize = size * uScale * (90.0 / -mv.z) * (0.8 + 0.4 * twinkle);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a * 1.6, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, material);
}

function milkyWay() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  const rand = rng(8);
  for (let i = 0; i < 260; i++) {
    const x = rand() * 1024;
    const y = 128 + (rand() - 0.5) * 120 * (0.4 + rand());
    const r = 20 + rand() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() < 0.5;
    grad.addColorStop(0, warm ? 'rgba(255,214,160,0.028)' : 'rgba(150,180,255,0.024)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 65), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(0, 10, -110);
  m.rotation.z = 0.5;
  return m;
}

// Golden dust in the air around the instrument.
function goldDust(count) {
  const rand = rng(21);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([(rand() - 0.5) * 30, (rand() - 0.5) * 16, (rand() - 0.5) * 14], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,230,170,1)');
  grad.addColorStop(1, 'rgba(255,230,170,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd27a, opacity: 0.7 }));
  const base = pos.slice();
  points.userData.update = (t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      p.array[i * 3] = base[i * 3] + Math.sin(t * 0.13 + i) * 0.6;
      p.array[i * 3 + 1] = ((base[i * 3 + 1] + t * 0.18 + 8) % 16) - 8;
      p.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + i * 1.7) * 0.5;
    }
    p.needsUpdate = true;
  };
  return points;
}

export function startHero3D(host, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const canvas = renderer.domElement;
  canvas.className = 'hero-3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const post = createPost(renderer);
  const envMap = environment(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.Fog(0x05070c, 60, 220);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
  const narrowScreen = () => camera.aspect < 0.9;
  const stars = sky(window.innerWidth < 700 ? 1600 : 3200);
  scene.add(stars, milkyWay());
  const dust = goldDust(window.innerWidth < 700 ? 160 : 320);
  scene.add(dust);

  // Lights: a warm key from above left, a cool rim from behind, a lamp below.
  scene.add(new THREE.HemisphereLight(0xffe7c4, 0x0b0e18, 0.22));
  const key = new THREE.DirectionalLight(0xffe0b0, 1.35);
  key.position.set(-6, 8, 9);
  const rim = new THREE.DirectionalLight(0x8fb6ff, 1.2);
  rim.position.set(7, 3, -6);
  const lamp = new THREE.PointLight(0xffa24a, 14, 20, 2);
  lamp.position.set(0, -4, 4);
  scene.add(key, rim, lamp);

  const inst = astrolabe(envMap);
  const holder = new THREE.Group();
  holder.add(inst.group);
  scene.add(holder);
  const halo = glow(0xffc46a, 12, 0.1);
  halo.position.z = -1.5;
  holder.add(halo);

  // Planets on tilted orbits around the instrument.
  const orbits = new THREE.Group();
  orbits.rotation.set(1.15, 0.2, 0.15);
  holder.add(orbits);
  const planets = [[4.4, 0xffd9a0, 0.16, 0.22], [5.3, 0x9fc4ff, 0.12, -0.15], [6.4, 0xff9f6a, 0.2, 0.1]].map(([r, color, size, speed], i) => {
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 220), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.22 }));
    orbits.add(ringMesh);
    const body = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.5 }));
    const aura = glow(color, size * 9, 0.5);
    const planet = new THREE.Group();
    planet.add(body, aura);
    orbits.add(planet);
    return { planet, r, speed, phase: i * 2.1 };
  });

  // Formulas of the discoveries drifting in the dark.
  const rand = rng(33);
  const formulas = ['x² + 10x = 39', 'π ≈ 3,14159265358979', 'R ≈ 6340 км', '0', 'sin² + cos² = 1', 'x³ + ax = b', '1 2 3 4 5 6 7 8 9 0', 'الجبر'].map((text, i) => {
    const s = label(text, { size: 0.55 + rand() * 0.4, family: SERIF, color: '#ffd98f', background: null, glow: 0.8, weight: 600 });
    s.position.set((rand() - 0.5) * 26, (rand() - 0.5) * 12, -8 - rand() * 14);
    s.material.opacity = 0;
    s.userData = { ...s.userData, base: s.position.clone(), phase: rand() * 10, speed: 0.15 + rand() * 0.2, delay: 1.5 + i * 0.6 };
    scene.add(s);
    return s;
  });
  // A shooting star now and then.
  const meteor = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.035), new THREE.MeshBasicMaterial({ color: 0xfff3d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(meteor);
  let meteorAt = 4;

  let width = 1;
  let height = 1;
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    const pr = renderer.getPixelRatio();
    post.setSize(Math.round(width * pr), Math.round(height * pr));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    stars.material.uniforms.uScale.value = pr * (height / 900);
    dirty = true;
  };
  let dirty = true;
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // Pointer and scroll.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (event) => {
    pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(host);

  let running = true;
  let last = performance.now();
  let time = 0;
  let frame = 0;
  const draw = (dt) => {
    time += dt;
    const t = time;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    const scroll = Math.min(1, window.scrollY / Math.max(1, height));
    const intro = Math.min(1, t / 2.6);
    const ease = 1 - (1 - intro) ** 3;

    // The instrument: comes out of the dark, the rete and the rule turn.
    // Wide screens: the instrument stands to the right of the title, turned
    // toward it; phones: behind the title, smaller and lower.
    const narrow = narrowScreen();
    const side = narrow ? 0 : Math.min(5.6, 2.2 + camera.aspect * 1.9);
    holder.position.set(side, narrow ? -1.3 : -0.55, narrow ? -2 : 0);
    holder.scale.setScalar((narrow ? 0.7 : 0.92) * (0.85 + 0.15 * ease));
    inst.group.rotation.set(-0.3 + scroll * 0.5 + pointer.y * 0.08, (narrow ? -0.2 : -0.62) + Math.sin(t * 0.12) * 0.1 + pointer.x * 0.16, 0.05);
    inst.rete.rotation.z = -t * 0.06 - (1 - ease) * 2.4;
    inst.rule.rotation.z = t * 0.035 + 0.6;
    inst.tips.forEach(({ tip, phase }) => {
      tip.material.opacity = 0.55 + 0.45 * Math.sin(t * 2 + phase);
    });
    halo.material.opacity = 0.09 * ease;
    planets.forEach(({ planet, r, speed, phase }) => {
      const a = t * speed + phase;
      planet.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    });
    orbits.rotation.z = 0.15 + t * 0.01;
    stars.material.uniforms.uTime.value = t;
    stars.rotation.z = t * 0.004;
    dust.userData.update(t);
    formulas.forEach((s) => {
      const { base, phase, speed, delay } = s.userData;
      s.position.set(base.x + Math.sin(t * speed + phase) * 0.8, base.y + Math.cos(t * speed * 0.8 + phase) * 0.5, base.z);
      s.material.opacity = Math.min(1, Math.max(0, (t - delay) / 2)) * (0.22 + 0.12 * Math.sin(t * 0.5 + phase));
    });
    if (t > meteorAt) {
      const u = (t - meteorAt) / 1.1;
      if (u > 1) meteorAt = t + 6 + Math.random() * 8;
      else {
        meteor.position.set(lerpN(14, -6, u), lerpN(9, 4, u), -30);
        meteor.rotation.z = 0.25;
        meteor.material.opacity = Math.sin(Math.PI * u) * 0.9;
      }
    }

    camera.position.set(pointer.x * 0.8, 0.3 - pointer.y * 0.5 + scroll * 1.5, (narrow ? 19 : 14.5) + scroll * 3);
    camera.lookAt(0, scroll * 0.8, 0);
    post.renderContent(scene, camera, { tone: true });
    post.composite({ mix: 1, time: t, leak: 0.05, black: 1 - ease });
  };
  const lerpN = (a, b, u) => a + (b - a) * u;
  let stop = null;
  const loop = (now) => {
    if (!running) return;
    // The page changed: the title screen is gone, so is its 3D.
    if (!host.isConnected) {
      stop();
      return;
    }
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    if (reduced && !dirty) return;
    draw(reduced ? 3 : dt);
    dirty = false;
  };
  resize();
  frame = requestAnimationFrame(loop);

  stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onMove);
    post.dispose();
    envMap.dispose();
    renderer.dispose();
    canvas.remove();
  };
  return stop;
}
