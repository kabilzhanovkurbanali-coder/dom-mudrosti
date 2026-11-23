"""Второй проход нейросети по кадрам фильмов: чёткие лица и мелкие детали.

1. Лица: каждое лицо (их находит встроенный в macOS Vision, см.
   tools/faces.swift) вырезается, перерисовывается крупно, в 832 точки,
   и вклеивается обратно с мягким краем. Так глаза и черты лица
   становятся резкими даже у людей на заднем плане. Это тот же приём,
   что ADetailer в Stable Diffusion.
2. С --hires кадр ещё и увеличивается (в 1,16 раза — больше не входит
   в 16 ГБ) и перерисовывается с малой силой ради мелких деталей.

Готовые кадры отмечаются в public/media/shots/refined.json (по хэшу
файла). Если gen_shots.py перерисует кадр, он пройдёт обработку снова.

    .venv/bin/python tools/refine.py                  # все кадры фильмов
    .venv/bin/python tools/refine.py --only al-biruni # один фильм
    .venv/bin/python tools/refine.py --names al-biruni/legend-1 --out /tmp/x
"""
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_shots as g  # noqa: E402

ROOT = g.ROOT
FACES_SRC = ROOT / "tools" / "faces.swift"
FACES_BIN = ROOT / ".build" / "faces"
REFINED = g.OUT / "refined.json"
SCALE = 1.16  # more does not fit into 16 GB
FACE_RES = 832
FACE_PROMPT = "close-up photo, detailed face, sharp focus on the eyes, clear iris, natural skin texture, realistic eyelashes"


def file_hash(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:16]


def ensure_detector() -> None:
    if FACES_BIN.exists() and FACES_BIN.stat().st_mtime >= FACES_SRC.stat().st_mtime:
        return
    FACES_BIN.parent.mkdir(exist_ok=True)
    subprocess.run(["swiftc", "-O", str(FACES_SRC), "-o", str(FACES_BIN)], check=True)


def detect(image: Image.Image) -> list[list[int]]:
    """Face boxes [x, y, w, h] in pixels, largest first."""
    ensure_detector()
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        image.convert("RGB").save(tmp.name, "JPEG", quality=92)
        out = subprocess.run([str(FACES_BIN), tmp.name], capture_output=True, text=True, check=True).stdout
    boxes = json.loads(out.strip().splitlines()[0])["faces"] if out.strip() else []
    return sorted(boxes, key=lambda b: -b[2] * b[3])


def feather(side: int) -> Image.Image:
    """A round mask, solid in the middle and soft toward the edges."""
    y, x = np.mgrid[0:side, 0:side].astype(np.float32)
    r = np.hypot(x - side / 2, y - side / 2) / (side / 2)
    a = np.clip((0.92 - r) / 0.32, 0, 1)
    a = a * a * (3 - 2 * a)
    return Image.fromarray((a * 255).astype(np.uint8), "L")


class Refiner:
    def __init__(self, pipe):
        from diffusers import StableDiffusionXLImg2ImgPipeline

        # The same weights as the main pipeline (from_pipe would copy them: 2× memory).
        self.pipe = StableDiffusionXLImg2ImgPipeline(**{**pipe.components, "scheduler": g.make_scheduler(pipe.scheduler.config, "euler-a")})
        self.pipe.set_progress_bar_config(disable=True)

    def _redraw(self, image, prompt, negative, seed, strength, steps=10):
        # The picture is encoded by hand, in one piece: the tiled encoder of
        # this diffusers version returns noise. Decoding stays tiled.
        vae = self.pipe.vae
        x = self.pipe.image_processor.preprocess(image).to(vae.device, vae.dtype)
        vae.disable_tiling()
        with torch.no_grad():
            latents = vae.encode(x).latent_dist.mean * vae.config.scaling_factor
        vae.enable_tiling()
        return self.pipe(
            prompt=prompt, negative_prompt=negative, image=latents, strength=strength,
            num_inference_steps=steps, guidance_scale=g.GUIDANCE,
            generator=torch.Generator("cpu").manual_seed(seed),
        ).images[0]

    def hires(self, image, prompt, negative, seed, scale=SCALE, strength=0.32):
        w, h = image.size
        tw, th = round(w * scale), round(h * scale)
        big = image.resize((round(tw / 8) * 8, round(th / 8) * 8), Image.LANCZOS)
        out = self._redraw(big, prompt, negative, seed, strength)
        return out.resize((tw, th), Image.LANCZOS) if out.size != (tw, th) else out

    def faces(self, image, prompt, negative, seed, boxes=None, limit=6):
        boxes = detect(image) if boxes is None else boxes
        out = image.convert("RGB").copy()
        W, H = out.size
        done = 0
        for i, (x, y, w, h) in enumerate(boxes[:limit]):
            size = max(w, h)
            if size < 18:
                continue
            # Small faces get more room around them and a stronger redraw.
            pad = 2.4 if size < 70 else 2.0 if size < 200 else 1.7
            strength = 0.5 if size < 70 else 0.42 if size < 200 else 0.33
            side = min(int(size * pad), W, H)
            cx, cy = x + w / 2, y + h * 0.45
            left = int(min(max(cx - side / 2, 0), W - side))
            top = int(min(max(cy - side / 2, 0), H - side))
            crop = out.crop((left, top, left + side, top + side))
            res = max(FACE_RES, round(side / 8) * 8)
            redone = self._redraw(crop.resize((res, res), Image.LANCZOS), f"{FACE_PROMPT}, {prompt}", negative, seed + 17 * (i + 1), strength)
            out.paste(redone.resize((side, side), Image.LANCZOS), (left, top), feather(side))
            done += 1
        return out, done


def jobs_for(args) -> list:
    data = json.loads(g.SHOTS.read_text(encoding="utf-8"))
    films = json.loads(g.FILMS.read_text(encoding="utf-8"))
    used = g.used_photos(films, data)
    jobs = []
    for slug, scholar in data["scholars"].items():
        if args.only and slug not in args.only:
            continue
        for ref, shots in scholar["beats"].items():
            for i, shot in enumerate(shots):
                name = g.shot_name(slug, ref, i)
                if name.split("/", 1)[1] not in used.get(slug, ()):
                    continue
                if args.names and name not in args.names:
                    continue
                path = g.OUT / f"{name}.jpg"
                if not path.exists():
                    continue
                prompt, negative = g.prompt_of(data, scholar, shot)
                negative = f"{negative}, {data.get('face_negative', '')}"
                jobs.append((name, path, prompt, negative))
    return jobs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="slug учёных")
    ap.add_argument("--names", nargs="*", help="кадры вида slug/s1-1")
    ap.add_argument("--out", help="сохранить в другую папку (для сравнения)")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--hires", action="store_true", help="ещё и увеличить кадр")
    args = ap.parse_args()

    refined = json.loads(REFINED.read_text(encoding="utf-8")) if REFINED.exists() else {}
    todo = [j for j in jobs_for(args) if args.force or args.out or refined.get(j[0]) != file_hash(j[1])]
    # Portraits and the first shot of each part first: they are on screen the longest.
    todo.sort(key=lambda j: (0 if "/portrait-" in j[0] or "/intro-" in j[0] else 1, int(j[0].rsplit("-", 1)[1])))
    print(f"Кадров обработать: {len(todo)}", flush=True)
    if not todo:
        return
    ensure_detector()
    pipe, dev = g.load_pipeline()
    refiner = Refiner(pipe)
    estimator = None if args.out else g.load_depth()
    started = time.time()
    for n, (name, path, prompt, negative) in enumerate(todo, 1):
        image = Image.open(path).convert("RGB")
        seed = g.seed_of(f"{name}#refine")
        if args.hires and image.width <= g.WIDTH:
            image = refiner.hires(image, prompt, negative, seed)
        image, faces = refiner.faces(image, prompt, negative, seed)
        target = Path(args.out) / f"{name.replace('/', '__')}.jpg" if args.out else path
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "JPEG", quality=90, optimize=True, progressive=True)
        if not args.out:
            g.make_depth(estimator, image, g.OUT / f"{name}.depth.png")
            refined[name] = file_hash(path)
            REFINED.write_text(json.dumps(refined, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        if dev == "mps":
            torch.mps.empty_cache()
        per = (time.time() - started) / n
        print(f"[{n}/{len(todo)}] {name}: лиц {faces}  ~{per:.0f} с/кадр, осталось ~{per * (len(todo) - n) / 60:.0f} мин", flush=True)
    print("Готово.")


if __name__ == "__main__":
    main()
