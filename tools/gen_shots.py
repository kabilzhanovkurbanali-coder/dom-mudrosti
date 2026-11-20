"""Создаёт кадры фильмов по раскадровке data/shots.json.

Кадры рисует нейросеть RealVisXL V5 Lightning (Stable Diffusion XL),
к каждому кадру строится карта глубины (Depth Anything V2) — по ней
плеер двигает камеру с параллаксом, и картинка выглядит объёмной.

Готовые кадры не перерисовываются, пока не изменится их описание
(хэши описаний хранятся в public/media/shots/manifest.json).

    .venv/bin/python tools/gen_shots.py                 # все фильмы
    .venv/bin/python tools/gen_shots.py --only ulugbek  # один фильм
    .venv/bin/python tools/gen_shots.py --depth-only    # только карты глубины

Модель (~7 ГБ) скачивается при первом запуске. Путь к уже скачанной
модели можно задать переменной SHOTS_MODEL.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "data" / "shots.json"
FILMS = ROOT / "data" / "films.json"
OUT = ROOT / "public" / "media" / "shots"
MANIFEST = OUT / "manifest.json"

MODEL = os.environ.get("SHOTS_MODEL", "SG161222/RealVisXL_V5.0_Lightning")
VAE = os.environ.get("SHOTS_VAE", "madebyollin/sdxl-vae-fp16-fix")
DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"

WIDTH, HEIGHT = 1152, 648
SAMPLER = os.environ.get("SHOTS_SAMPLER", "dpmpp-2m-sde-karras")
STEPS = int(os.environ.get("SHOTS_STEPS", "6"))
GUIDANCE = float(os.environ.get("SHOTS_GUIDANCE", "1.8"))
SEED_SALT = "dom-mudrosti-1"


def shot_name(slug: str, ref: str, index: int) -> str:
    key = f"s{ref[6:]}" if ref.startswith("story:") else ref
    return f"{slug}/{key}-{index + 1}"


# Сцены в Европе и в наше время не получают «восточного» контекста эпохи.
OWN_SETTING = re.compile(
    r"europe|monk|friar|genoese|caravel|atlantic|victorian|dutch|danish|oxford|english|modern|programmer"
    r"|19\d\d|renaissance|toledo|moon|planet earth|earth seen|space|laptop|mall|museum|university",
    re.IGNORECASE,
)


def prompt_of(data: dict, scholar: dict, shot: dict) -> tuple[str, str]:
    text = shot["p"].replace("{hero}", scholar.get("hero", "a medieval scholar"))
    negative = data["negative"]
    if scholar.get("setting") and not OWN_SETTING.search(shot["p"]):
        text = f"{text}, {scholar['setting']}"
        negative = f"{negative}, european, blond hair"
    return f"{text}, {data['style']}", negative


PORTRAIT_VARIANTS = int(os.environ.get("SHOTS_PORTRAIT_VARIANTS", "2"))


def used_photos(films: dict, data: dict) -> dict:
    """Кадры, которые показывают фильмы (как в server/film.js usedPhotos)."""
    used = {}
    for slug in data["scholars"]:
        names = {"intro-1", "portrait-1"}
        for beat in films.get(slug, []):
            photos = beat.get("photos", [])
            animate = beat.get("animate")
            if animate == "only":
                photos = []
            elif animate:
                photos = photos[:1]
            names.update(photos)
        used[slug] = names
    return used


def seed_of(name: str) -> int:
    return int(hashlib.sha1(f"{SEED_SALT}|{name}".encode()).hexdigest()[:8], 16)


def device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load_pipeline():
    from diffusers import AutoencoderKL, StableDiffusionXLPipeline

    dev = device()
    dtype = torch.float16 if dev != "cpu" else torch.float32
    vae = AutoencoderKL.from_pretrained(VAE, torch_dtype=dtype)
    pipe = StableDiffusionXLPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=dtype, variant="fp16" if dtype == torch.float16 else None)
    pipe.scheduler = make_scheduler(pipe.scheduler.config, SAMPLER)
    pipe.to(dev)
    pipe.set_progress_bar_config(disable=True)
    # Декодер по частям: иначе пик памяти на 16 ГБ уводит систему в своп
    # и кадр рисуется втрое дольше.
    pipe.vae.enable_tiling()
    return pipe, dev


def make_scheduler(config, name: str):
    """Lightning-модели рассчитаны на DPM++ SDE с сигмами Karras и 4–6 шагов."""
    from diffusers import DPMSolverMultistepScheduler, EulerAncestralDiscreteScheduler

    if name == "dpmpp-2m-sde-karras":
        return DPMSolverMultistepScheduler.from_config(config, algorithm_type="sde-dpmsolver++", use_karras_sigmas=True)
    if name == "euler-a":
        return EulerAncestralDiscreteScheduler.from_config(config, timestep_spacing="trailing")
    raise SystemExit(f"неизвестный сэмплер {name}")


def load_depth():
    from transformers import pipeline

    return pipeline("depth-estimation", model=DEPTH_MODEL, device=device())


def make_depth(estimator, image: Image.Image, target: Path) -> None:
    depth = estimator(image)["predicted_depth"]
    d = depth.squeeze().float().cpu().numpy()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    img = Image.fromarray((d * 255).astype(np.uint8), "L").resize((WIDTH // 2, HEIGHT // 2), Image.BICUBIC)
    # Передний план чуть расширяем и сглаживаем: так на границах предметов
    # при движении камеры меньше «резиновых» растяжек.
    img = img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.5))
    img.save(target, optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="slug учёных")
    ap.add_argument("--depth-only", action="store_true")
    ap.add_argument("--force", action="store_true", help="перерисовать всё заново")
    ap.add_argument("--limit", type=int, default=0, help="не больше N новых кадров")
    args = ap.parse_args()

    data = json.loads(SHOTS.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    # Only the pictures the films show (see used_photos), portraits first.
    films = json.loads(FILMS.read_text(encoding="utf-8"))
    used = used_photos(films, data)

    jobs = []
    for slug, scholar in data["scholars"].items():
        if args.only and slug not in args.only:
            continue
        for ref, shots in scholar["beats"].items():
            for i, shot in enumerate(shots):
                name = shot_name(slug, ref, i)
                if name.split("/", 1)[1] not in used.get(slug, ()):
                    continue
                prompt, negative = prompt_of(data, scholar, shot)
                if ref == "portrait":
                    negative = f"{negative}, {data.get('face_negative', '')}"
                digest = hashlib.sha1(f"{prompt}|{negative}".encode()).hexdigest()[:12]
                image_path = OUT / f"{name}.jpg"
                fresh = image_path.exists() and manifest.get(name) == digest and not args.force
                jobs.append((name, (prompt, negative), digest, image_path, fresh))

    # Сначала по одному кадру на каждую часть всех фильмов, потом вторые и т. д. —
    # так все фильмы быстро получают картинку.
    todo = sorted((j for j in jobs if not j[4]), key=lambda j: (0 if "/portrait-" in j[0] else 1, int(j[0].rsplit("-", 1)[1])))
    if args.limit:
        todo = todo[: args.limit]
    print(f"Кадров в раскадровке: {len(jobs)}, нарисовать: {0 if args.depth_only else len(todo)}", flush=True)

    estimator = None
    if todo and not args.depth_only:
        pipe, dev = load_pipeline()
        estimator = load_depth()
        print(f"Модель загружена ({dev})", flush=True)
        started = time.time()
        for n, (name, (prompt, negative), digest, image_path, _) in enumerate(todo, 1):
            image_path.parent.mkdir(parents=True, exist_ok=True)
            variants = PORTRAIT_VARIANTS if "/portrait-" in name else 1
            for v in range(1, variants):
                extra = pipe(
                    prompt=prompt, negative_prompt=negative, width=WIDTH, height=HEIGHT,
                    num_inference_steps=STEPS, guidance_scale=GUIDANCE,
                    generator=torch.Generator("cpu").manual_seed(seed_of(f"{name}#{v}")),
                ).images[0]
                extra.save(OUT / f"{name}.v{v + 1}.jpg", "JPEG", quality=90)
            generator = torch.Generator("cpu").manual_seed(seed_of(name))
            image = pipe(
                prompt=prompt,
                negative_prompt=negative,
                width=WIDTH,
                height=HEIGHT,
                num_inference_steps=STEPS,
                guidance_scale=GUIDANCE,
                generator=generator,
            ).images[0]
            image.save(image_path, "JPEG", quality=90, optimize=True, progressive=True)
            if variants > 1:
                image.save(OUT / f"{name}.v1.jpg", "JPEG", quality=90)
            make_depth(estimator, image, OUT / f"{name}.depth.png")
            if dev == "mps":
                torch.mps.empty_cache()
            manifest[name] = digest
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
            per = (time.time() - started) / n
            print(f"[{n}/{len(todo)}] {name}  ~{per:.0f} с/кадр, осталось ~{per * (len(todo) - n) / 60:.0f} мин", flush=True)
        del pipe
        if device() == "mps":
            torch.mps.empty_cache()

    for name, _, _, image_path, _ in jobs:
        depth_path = OUT / f"{name}.depth.png"
        if not image_path.exists() or (depth_path.exists() and depth_path.stat().st_mtime >= image_path.stat().st_mtime):
            continue
        if estimator is None:
            estimator = load_depth()
        make_depth(estimator, Image.open(image_path).convert("RGB"), depth_path)
        print(f"глубина: {name}", flush=True)
    print("Готово.")


if __name__ == "__main__":
    sys.exit(main())
