"""Озвучивает текст нейроголосом Microsoft Edge (edge-tts).

Текст читается из stdin. Пишет аудио (mp3) и тайминги слов (json),
по которым плеер подсвечивает субтитры слово за словом.

    echo "Текст" | .venv/bin/python tools/tts.py --voice ru-RU-SvetlanaNeural --out a.mp3 --timings a.json
"""
import argparse
import asyncio
import json
import sys

import edge_tts


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="ru-RU-SvetlanaNeural")
    ap.add_argument("--rate", default="+0%")
    ap.add_argument("--pitch", default="+0Hz")
    ap.add_argument("--out", required=True)
    ap.add_argument("--timings", required=True)
    args = ap.parse_args()

    text = sys.stdin.read().strip()
    if not text:
        sys.exit("пустой текст")

    words = []
    for attempt in range(3):
        try:
            words = []
            com = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch, boundary="WordBoundary")
            with open(args.out, "wb") as f:
                async for chunk in com.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        start = chunk["offset"] / 1e7
                        words.append([round(start, 3), round(start + chunk["duration"] / 1e7, 3), chunk["text"]])
            break
        except Exception as error:  # сеть или сервис временно недоступны
            if attempt == 2:
                raise
            print(f"повтор после ошибки: {error}", file=sys.stderr)
            await asyncio.sleep(2 * (attempt + 1))

    with open(args.timings, "w", encoding="utf-8") as f:
        json.dump({"voice": args.voice, "words": words}, f, ensure_ascii=False)


asyncio.run(main())
