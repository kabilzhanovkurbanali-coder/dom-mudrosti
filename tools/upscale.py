"""Чёткие кадры для больших экранов: увеличение нейросетью Real-ESRGAN.

Нейросеть рисует кадры 1152×648, а смотрят их во весь экран. Простое
растяжение даёт мыло; Real-ESRGAN (x2) восстанавливает резкие края,
ткань и волосы. Результат — 1920×1080. Немного исходной текстуры
подмешивается обратно, чтобы кожа и ткань не стали «пластиковыми».

Готовые кадры отмечаются в public/media/shots/upscaled.json (по хэшу).
Кадр, который gen_shots.py нарисует заново, будет увеличен снова.
Заодно делаются лёгкие постеры (poster.jpg) для главной страницы.

    .venv/bin/python tools/upscale.py                  # все кадры фильмов
    .venv/bin/python tools/upscale.py --only al-biruni
    .venv/bin/python tools/upscale.py --names al-biruni/portrait-1 --out /tmp/x

Веса (~67 МБ) скачиваются при первом запуске в ~/.cache/dom-mudrosti/esrgan.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from torch import nn
from torch.nn import functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_shots as g  # noqa: E402

WEIGHTS_URL = "https://huggingface.co/ai-forever/Real-ESRGAN/resolve/main/RealESRGAN_x2.pth"
WEIGHTS = Path(os.environ.get("ESRGAN_WEIGHTS", Path.home() / ".cache" / "dom-mudrosti" / "esrgan" / "RealESRGAN_x2.pth"))
UPSCALED = g.OUT / "upscaled.json"
REFINED = g.OUT / "refined.json"
TARGET = (1920, 1080)
POSTER = (720, 405)
# Share of the plain enlargement mixed back in: keeps the fine grain of skin and cloth.
TEXTURE = 0.18


# ---- Real-ESRGAN network (RRDBNet, as in BasicSR) ----
class ResidualDenseBlock(nn.Module):
    def __init__(self, feat=64, grow=32):
        super().__init__()
        self.conv1 = nn.Conv2d(feat, grow, 3, 1, 1)
        self.conv2 = nn.Conv2d(feat + grow, grow, 3, 1, 1)
        self.conv3 = nn.Conv2d(feat + 2 * grow, grow, 3, 1, 1)
        self.conv4 = nn.Conv2d(feat + 3 * grow, grow, 3, 1, 1)
        self.conv5 = nn.Conv2d(feat + 4 * grow, feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, feat=64, grow=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(feat, grow)
        self.rdb2 = ResidualDenseBlock(feat, grow)
        self.rdb3 = ResidualDenseBlock(feat, grow)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    """x2 variant: the picture is folded into 12 channels at half size first."""

    def __init__(self, feat=64, blocks=23, grow=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3 * 4, feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(feat, grow) for _ in range(blocks)])
        self.conv_body = nn.Conv2d(feat, feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(feat, feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(feat, feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(feat, feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(feat, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(F.pixel_unshuffle(x, 2))
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def load_net(dev: str) -> RRDBNet:
    if not WEIGHTS.exists():
        WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
        print("Скачиваю Real-ESRGAN x2 (~67 МБ)…", flush=True)
        urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS)
    state = torch.load(WEIGHTS, map_location="cpu", weights_only=True)
    state = state.get("params_ema", state.get("params", state))
    net = RRDBNet()
    net.load_state_dict(state, strict=True)
    return net.eval().to(dev)


@torch.no_grad()
def enlarge(net: RRDBNet, image: Image.Image, dev: str, tile: int = 384, pad: int = 16) -> Image.Image:
    """x2 in overlapping tiles (keeps memory low on 16 GB)."""
    x = torch.from_numpy(np.asarray(image.convert("RGB"), dtype=np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = x.shape
    out = torch.zeros(1, 3, h * 2, w * 2)
    for top in range(0, h, tile):
        for left in range(0, w, tile):
            t0, l0 = max(top - pad, 0), max(left - pad, 0)
            t1, l1 = min(top + tile + pad, h), min(left + tile + pad, w)
            # Even sizes for the pixel unshuffle.
            t1 -= (t1 - t0) % 2
            l1 -= (l1 - l0) % 2
            part = net(x[:, :, t0:t1, l0:l1].to(dev)).float().cpu()
            ot, ol = (top - t0) * 2, (left - l0) * 2
            th, tw = min(tile, h - top) * 2, min(tile, w - left) * 2
            out[:, :, top * 2:top * 2 + th, left * 2:left * 2 + tw] = part[:, :, ot:ot + th, ol:ol + tw]
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(arr)


def sharpen(image: Image.Image, net: RRDBNet, dev: str) -> Image.Image:
    big = enlarge(net, image, dev).resize(TARGET, Image.LANCZOS)
    plain = image.convert("RGB").resize(TARGET, Image.LANCZOS)
    # A touch of the original grain, then a gentle unsharp mask for crisp edges.
    out = Image.blend(big, plain, TEXTURE)
    return out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=35, threshold=2))


def file_hash(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:16]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--names", nargs="*")
    ap.add_argument("--out")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    data = json.loads(g.SHOTS.read_text(encoding="utf-8"))
    films = json.loads(g.FILMS.read_text(encoding="utf-8"))
    used = g.used_photos(films, data)
    done = json.loads(UPSCALED.read_text(encoding="utf-8")) if UPSCALED.exists() else {}
    refined = json.loads(REFINED.read_text(encoding="utf-8")) if REFINED.exists() else {}
    jobs = []
    for slug, names in used.items():
        if args.only and slug not in args.only:
            continue
        for short in sorted(names):
            name = f"{slug}/{short}"
            path = g.OUT / f"{name}.jpg"
            if not path.exists() or (args.names and name not in args.names):
                continue
            if not (args.force or args.out) and done.get(name) == file_hash(path):
                continue
            jobs.append((name, path))
    print(f"Кадров увеличить: {len(jobs)}", flush=True)
    dev = g.device()
    net = load_net(dev) if jobs else None
    started = time.time()
    for n, (name, path) in enumerate(jobs, 1):
        before = file_hash(path)
        image = Image.open(path).convert("RGB")
        if image.width >= TARGET[0] and not args.force:
            # Already large (drawn or enlarged earlier): only remember it.
            done[name] = before
            continue
        out = sharpen(image, net, dev)
        target = Path(args.out) / f"{name.replace('/', '__')}.jpg" if args.out else path
        target.parent.mkdir(parents=True, exist_ok=True)
        out.save(target, "JPEG", quality=88, optimize=True, progressive=True)
        if not args.out:
            after = file_hash(path)
            done[name] = after
            # A refined picture stays refined after the enlargement.
            if refined.get(name) == before:
                refined[name] = after
                REFINED.write_text(json.dumps(refined, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
            UPSCALED.write_text(json.dumps(done, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        if dev == "mps":
            torch.mps.empty_cache()
        per = (time.time() - started) / n
        print(f"[{n}/{len(jobs)}] {name}  ~{per:.0f} с/кадр, осталось ~{per * (len(jobs) - n) / 60:.0f} мин", flush=True)
    if not args.out:
        UPSCALED.write_text(json.dumps(done, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        # Light posters for the home page.
        for slug in used:
            src = g.OUT / slug / "portrait-1.jpg"
            if src.exists():
                Image.open(src).convert("RGB").resize(POSTER, Image.LANCZOS).save(
                    g.OUT / slug / "poster.jpg", "JPEG", quality=82, optimize=True, progressive=True)
    print("Готово.")


if __name__ == "__main__":
    main()
