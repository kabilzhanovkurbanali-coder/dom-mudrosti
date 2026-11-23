"""Реалистичные учёные для 3D-анимаций: фигура по колено, вырезанная из фона.

Для каждого учёного рисуются позы, которые нужны его анимациям
(«показывает рукой», «держит свой инструмент», у Бируни — «идёт»,
«смотрит в астролябию», «на вершине»), лицо перерисовывается крупно
(tools/refine.py), а фон убирает встроенное в macOS «отделение объекта»
(tools/cutout.swift). Результат — public/media/cast/<slug>/<pose>.webp
с прозрачностью; плеер ставит такую фигуру в 3D-сцену.

    .venv/bin/python tools/gen_presenters.py [--only slug ...]
    .venv/bin/python tools/gen_presenters.py --rematte   # только заново вырезать фон
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_shots as g  # noqa: E402
from refine import Refiner  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "media" / "cast"
MANIFEST = OUT / "manifest.json"
W, H = 832, 1216

# What each scholar holds.
PROPS = {
    "al-khwarizmi": "a parchment scroll with drawings of squares",
    "al-farghani": "a brass astrolabe",
    "al-kindi": "a folded parchment letter",
    "ar-razi": "a round glass flask",
    "al-farabi": "a long-necked lute",
    "az-zahrawi": "a small steel surgical instrument",
    "ibn-al-haytham": "a round glass lens",
    "al-biruni": "a brass astrolabe",
    "ibn-sina": "a thick leather-bound book",
    "omar-khayyam": "a brass drawing compass",
    "al-jazari": "a large brass gear wheel",
    "nasir-ad-din-tusi": "a small brass armillary sphere",
    "ibn-an-nafis": "a leather-bound book",
    "al-kashi": "a brass drawing compass",
    "ulugbek": "a brass astrolabe",
    "ali-kushchi": "a brass astrolabe",
    "taqi-al-din": "a small brass mechanical clock",
    "yusuf-balasaguni": "a large illuminated book",
    "mahmud-kashgari": "a rolled parchment map",
    "abu-nasr-mansur": "a small brass celestial globe",
    "al-jawhari": "a large manuscript book",
    "haidar-dulati": "a leather-bound book",
    "alisher-navoi": "a large illuminated manuscript book",
}

POSES = {
    "point": "standing, three-quarter length portrait from the knees up, turned slightly to the right, pointing to the right with his open right hand, looking to the right",
    "hold": "standing, three-quarter length portrait from the knees up, holding {prop} in front of his chest with both hands, looking at the viewer",
}
# Al-Biruni's poses for the measurement of the Earth.
EXTRA = {
    "al-biruni": {
        "sight": "full body, seen from the side, standing on a plain and holding a brass astrolabe up to his eye, looking up to the right at a distant mountain top",
        "summit": "full body, seen from the side, standing on rocks and holding a brass astrolabe at eye level, looking straight to the right at the far horizon",
        "walk": "full body, seen from the side, walking to the right with a brass astrolabe hanging from his hand",
    },
    "ulugbek": {
        "stand": "full body, standing, seen from the side, holding a brass astrolabe and looking up to the right at the sky",
    },
    "al-jawhari": {
        "wings": "full body, seen from the side, standing with his arms spread wide like a bird, two flat wooden boards tied to his forearms like wings",
    },
}

STYLE = "photorealistic, detailed face, sharp eyes, natural skin texture, soft studio light, isolated on a plain light grey studio background"
NEGATIVE = (
    "text, watermark, logo, frame, border, cropped head, cartoon, anime, illustration, painting, 3d render, cgi, deformed, "
    "bad anatomy, extra fingers, extra limbs, mutated hands, deformed face, asymmetrical eyes, cross-eyed, blurry, out of focus, "
    "lowres, background scenery, furniture, other people, eyeglasses"
)


CUTOUT_SRC = ROOT / "tools" / "cutout.swift"
CUTOUT_BIN = ROOT / ".build" / "cutout"


def cutout(src: Path) -> Image.Image | None:
    """The person with what he holds, cut out by macOS Vision; None if it fails."""
    if not CUTOUT_BIN.exists() or CUTOUT_BIN.stat().st_mtime < CUTOUT_SRC.stat().st_mtime:
        CUTOUT_BIN.parent.mkdir(exist_ok=True)
        subprocess.run(["swiftc", "-O", str(CUTOUT_SRC), "-o", str(CUTOUT_BIN)], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        mask_path = Path(tmp) / "mask.png"
        out = subprocess.run([str(CUTOUT_BIN), str(src), str(mask_path)], capture_output=True, text=True).stdout
        if not out.startswith("ok"):
            print(f"  вырезка не удалась: {out.strip()}", flush=True)
            return None
        # One pixel in from the edge: no light fringe of the old backdrop.
        mask = Image.open(mask_path).convert("L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    image = Image.open(src).convert("RGBA")
    image.putalpha(mask)
    return image.crop(image.getbbox() or (0, 0, W, H))


def matte(image: Image.Image, depth: np.ndarray) -> Image.Image:
    """Fallback without Vision: near in depth and different from the backdrop."""
    rgb = np.asarray(image.convert("RGB")).astype(np.float32) / 255
    border = np.concatenate([rgb[:12].reshape(-1, 3), rgb[:, :12].reshape(-1, 3), rgb[:, -12:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    colour = np.clip(np.linalg.norm(rgb - bg, axis=2) / 0.16, 0, 1)
    d = (depth - np.percentile(depth, 5)) / max(np.percentile(depth, 99) - np.percentile(depth, 5), 1e-6)
    # Otsu-like split of the depth values.
    hist, edges = np.histogram(d, bins=64, range=(0, 1))
    best, cut = -1, 0.5
    total = hist.sum()
    for i in range(1, 63):
        w0, w1 = hist[:i].sum() / total, hist[i:].sum() / total
        if w0 == 0 or w1 == 0:
            continue
        m0 = (hist[:i] * edges[:i]).sum() / max(hist[:i].sum(), 1)
        m1 = (hist[i:] * edges[i:-1]).sum() / max(hist[i:].sum(), 1)
        score = w0 * w1 * (m0 - m1) ** 2
        if score > best:
            best, cut = score, edges[i]
    near = np.clip((d - cut + 0.08) / 0.16, 0, 1)
    alpha = np.maximum(near * 0.85 + colour * 0.15, colour * near)
    alpha = np.where(near > 0.95, 1.0, alpha)
    a = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), "L")
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = image.convert("RGBA")
    out.putalpha(a)
    return out.crop(out.getbbox() or (0, 0, W, H))


def needed_poses() -> dict:
    """Poses the films use: the scene of each animation and its pose in cast.js."""
    cast = (ROOT / "public" / "js" / "film" / "cast.js").read_text(encoding="utf-8")
    pose_of = dict(re.findall(r"'?([a-z-]+)'?: \{ side: '\w+', pose: '(\w+)' \}", cast))
    films = json.loads(g.FILMS.read_text(encoding="utf-8"))
    need = {}
    for slug, beats in films.items():
        for beat in beats if isinstance(beats, list) else []:
            pose = pose_of.get(beat.get("scene"))
            if beat.get("animate") and pose:
                need.setdefault(slug, set()).add(pose)
    return need


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--rematte", action="store_true", help="только заново вырезать фон из готовых картинок")
    args = ap.parse_args()
    if args.rematte:
        for src in sorted(OUT.glob("*/*.src.jpg")):
            if args.only and src.parent.name not in args.only:
                continue
            cut = cutout(src)
            if cut is not None:
                cut.save(src.with_name(src.name.replace(".src.jpg", ".webp")), "WEBP", quality=88, method=6)
                print(f"вырезано: {src.parent.name}/{src.name}", flush=True)
        return
    data = json.loads(g.SHOTS.read_text(encoding="utf-8"))
    need = needed_poses()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    jobs = []
    for slug, scholar in data["scholars"].items():
        if args.only and slug not in args.only:
            continue
        hero = scholar["hero"]
        # Real people of modern times are not drawn: no made-up likenesses.
        if scholar.get("likeness") is False:
            continue
        poses = {k: v.format(prop=PROPS.get(slug, "a book")) for k, v in POSES.items() if k in need.get(slug, ())}
        poses.update(EXTRA.get(slug, {}))
        for pose, text in poses.items():
            prompt = f"{text}, {hero}, {scholar.get('setting', 'medieval')} clothing, dignified face, wise kind eyes, {STYLE}"
            digest = hashlib.sha1(f"{prompt}|{NEGATIVE}".encode()).hexdigest()[:12]
            name = f"{slug}/{pose}"
            target = OUT / f"{name}.webp"
            if target.exists() and manifest.get(name) == digest:
                continue
            jobs.append((name, prompt, digest, target, slug))
    print(f"Фигур нарисовать: {len(jobs)}", flush=True)
    if not jobs:
        return
    pipe, dev = g.load_pipeline()
    refiner = Refiner(pipe)
    depth = None
    face_negative = f"{NEGATIVE}, {data.get('face_negative', '')}"
    for n, (name, prompt, digest, target, slug) in enumerate(jobs, 1):
        # One seed for all poses of a scholar: the same face in every pose.
        seed = g.seed_of(f"{slug}#cast")
        image = pipe(
            prompt=prompt, negative_prompt=NEGATIVE, width=W, height=H, num_inference_steps=g.STEPS,
            guidance_scale=g.GUIDANCE, generator=torch.Generator("cpu").manual_seed(seed),
        ).images[0]
        # A sharp face: redrawn large and pasted back (see tools/refine.py).
        image, _ = refiner.faces(image, prompt, face_negative, seed, limit=1)
        target.parent.mkdir(parents=True, exist_ok=True)
        src = target.with_suffix(".src.jpg")
        image.save(src, "JPEG", quality=90)
        cut = cutout(src)
        if cut is None:
            depth = depth or g.load_depth()
            d = depth(image)["predicted_depth"].squeeze().float().cpu().numpy()
            cut = matte(image, np.asarray(Image.fromarray(d).resize((W, H), Image.BICUBIC)))
        # Written to a temporary name first: the server lists ready poses only.
        tmp = target.with_suffix(".tmp")
        cut.save(tmp, "WEBP", quality=88, method=6)
        tmp.replace(target)
        manifest[name] = digest
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        if dev == "mps":
            torch.mps.empty_cache()
        print(f"[{n}/{len(jobs)}] {name}", flush=True)
    print("Готово.")


if __name__ == "__main__":
    main()
