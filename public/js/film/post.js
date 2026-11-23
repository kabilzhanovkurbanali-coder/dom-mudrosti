// Film look for everything the engine draws: the frame is rendered into a
// texture and then composited with glow (bloom), a warm colour grade,
// vignette, film grain, a light leak and cross-fades between shots.
import { THREE } from './kit.js';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D tInput;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.35, l), 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb * 0.2270270;
    c += texture2D(tInput, vUv + uStep * 1.3846154).rgb * 0.3162162;
    c += texture2D(tInput, vUv - uStep * 1.3846154).rgb * 0.3162162;
    c += texture2D(tInput, vUv + uStep * 3.2307692).rgb * 0.0702703;
    c += texture2D(tInput, vUv - uStep * 3.2307692).rgb * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tA;      // current frame
  uniform sampler2D tB;      // frozen previous frame (for cross-fades)
  uniform sampler2D tBloom;
  uniform float uMix;        // 0 = previous frame, 1 = current frame
  uniform float uToneA;      // 1 = lit 3D scene (needs tone mapping), 0 = photo
  uniform float uToneB;
  uniform float uTime;
  uniform vec2 uRes;
  uniform float uBloom;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uLeak;
  uniform float uAberration;
  uniform float uBlack;      // fade to black
  uniform vec2 uTexel;       // size of one pixel
  uniform float uSharpen;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  vec3 display(vec3 linear, float tone) {
    return toSRGB(tone > 0.5 ? aces(linear * 1.1) : linear);
  }
  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }
  vec3 sampleA(vec2 uv) {
    vec2 d = uv - 0.5;
    float k = uAberration * dot(d, d);
    vec3 c = vec3(
      texture2D(tA, uv - d * k).r,
      texture2D(tA, uv).g,
      texture2D(tA, uv + d * k).b
    );
    // Unsharp mask: the pictures are upscaled to the screen, this keeps them crisp.
    vec3 around = (
      texture2D(tA, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(tA, uv - vec2(uTexel.x, 0.0)).rgb +
      texture2D(tA, uv + vec2(0.0, uTexel.y)).rgb + texture2D(tA, uv - vec2(0.0, uTexel.y)).rgb
    ) * 0.25;
    return max(c + (c - around) * uSharpen, 0.0);
  }

  void main() {
    vec3 a = display(sampleA(vUv) + texture2D(tBloom, vUv).rgb * uBloom, uToneA);
    vec3 b = display(texture2D(tB, vUv).rgb, uToneB);
    vec3 c = mix(b, a, uMix);

    // Grade: teal shadows, amber highlights, a soft S-curve.
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += vec3(-0.018, 0.004, 0.028) * (1.0 - smoothstep(0.0, 0.5, l));
    c += vec3(0.045, 0.018, -0.03) * smoothstep(0.45, 1.0, l);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
    c = mix(vec3(l), c, 1.05);

    // Light leak: a warm glow drifting along the edge, brighter on cuts.
    vec2 lp = vec2(0.92 + 0.08 * sin(uTime * 0.21), 0.15 + 0.1 * sin(uTime * 0.13));
    float leak = smoothstep(0.85, 0.0, distance(vUv * vec2(uRes.x / uRes.y, 1.0), lp * vec2(uRes.x / uRes.y, 1.0)));
    c += vec3(1.0, 0.55, 0.22) * leak * uLeak;

    // Vignette.
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float r = length(q) / length(vec2(0.5 * uRes.x / uRes.y, 0.5));
    c *= mix(1.0, smoothstep(1.08, 0.32, r), uVignette);

    // Grain, stronger in the mid-tones, like film.
    float g = hash(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
    c += g * uGrain * (1.0 - abs(l - 0.45));

    c *= 1.0 - uBlack;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

export function createPost(renderer) {
  const webgl2 = renderer.capabilities.isWebGL2;
  const options = { type: THREE.HalfFloatType, depthBuffer: true, samples: webgl2 ? 4 : 0 };
  let rtA = new THREE.WebGLRenderTarget(1, 1, options);
  let rtB = new THREE.WebGLRenderTarget(1, 1, options);
  const small = { type: THREE.HalfFloatType, depthBuffer: false };
  const bloomA = new THREE.WebGLRenderTarget(1, 1, small);
  const bloomB = new THREE.WebGLRenderTarget(1, 1, small);

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);

  const material = (frag, uniforms) =>
    new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const bright = material(BRIGHT_FRAG, { tInput: { value: null }, uThreshold: { value: 0.8 } });
  const blur = material(BLUR_FRAG, { tInput: { value: null }, uStep: { value: new THREE.Vector2() } });
  const composite = material(COMPOSITE_FRAG, {
    tA: { value: null },
    tB: { value: null },
    tBloom: { value: null },
    uMix: { value: 1 },
    uToneA: { value: 0 },
    uToneB: { value: 0 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBloom: { value: 0.2 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.55 },
    uLeak: { value: 0.06 },
    uAberration: { value: 0.003 },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uSharpen: { value: 0.45 },
    uBlack: { value: 0 },
  });

  let toneA = 0;
  let toneB = 0;
  let width = 1;
  let height = 1;

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  return {
    setSize(w, h) {
      width = w;
      height = h;
      rtA.setSize(w, h);
      rtB.setSize(w, h);
      const bw = Math.max(1, Math.round(w / 4));
      const bh = Math.max(1, Math.round(h / 4));
      bloomA.setSize(bw, bh);
      bloomB.setSize(bw, bh);
      composite.uniforms.uRes.value.set(w, h);
      composite.uniforms.uTexel.value.set(1 / w, 1 / h);
    },

    // Draws a scene into the current frame texture.
    renderContent(scene, camera, { tone = false, overlay = null } = {}) {
      toneA = tone ? 1 : 0;
      renderer.setRenderTarget(rtA);
      renderer.clear();
      renderer.render(scene, camera);
      // A layer drawn over the scene with its own depth (the presenting scholar).
      if (overlay) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(overlay, camera);
        renderer.autoClear = true;
      }
    },

    // Freezes the last frame as the start of a cross-fade.
    capture() {
      [rtA, rtB] = [rtB, rtA];
      toneB = toneA;
    },

    composite({ mix = 1, time = 0, leak = 0.06, black = 0 } = {}) {
      bright.uniforms.tInput.value = rtA.texture;
      pass(bright, bloomA);
      for (let i = 0; i < 2; i++) {
        blur.uniforms.tInput.value = bloomA.texture;
        blur.uniforms.uStep.value.set(1.6 / bloomA.width, 0);
        pass(blur, bloomB);
        blur.uniforms.tInput.value = bloomB.texture;
        blur.uniforms.uStep.value.set(0, 1.6 / bloomA.height);
        pass(blur, bloomA);
      }
      const u = composite.uniforms;
      u.tA.value = rtA.texture;
      u.tB.value = rtB.texture;
      u.tBloom.value = bloomA.texture;
      u.uMix.value = mix;
      u.uToneA.value = toneA;
      u.uToneB.value = toneB;
      u.uTime.value = time;
      u.uLeak.value = leak;
      u.uBlack.value = black;
      u.uGrain.value = 0.03;
      // Photos get the crisping, the 3D animations are sharp already.
      u.uSharpen.value = toneA ? 0.15 : 0.45;
      pass(composite, null);
    },

    dispose() {
      for (const rt of [rtA, rtB, bloomA, bloomB]) rt.dispose();
      for (const m of [bright, blur, composite]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
