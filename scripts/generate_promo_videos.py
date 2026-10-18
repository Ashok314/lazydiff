#!/usr/bin/env python3
"""Generate LazyDiff demo videos from frames, TTS, music, and ffmpeg.

This is intentionally kept as a local generation helper. The committed website
only needs the final MP4 files under site/assets/video/.
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TTS_PYTHON = ROOT / ".venv-tts/bin/python"
VIDEO_ROOT = ROOT / "store/video"
AUDIO_ROOT = VIDEO_ROOT / "neural-audio/v2"
MUSIC_BED = VIDEO_ROOT / "music/generated/e2-warm-no-drone-bed.wav"

LANGUAGES = {
    "en": {
        "pipeline": "a",
        "voice": "af_heart",
        "speed": 1.12,
        "site_video": "lazydiff-promo.mp4",
        "store_video": "lazydiff-promo-v2-long.mp4",
        "audio_dir": AUDIO_ROOT,
        "copy": {
            "long": """Big pull requests looks noisy?
Skip the noise.
Hide generated files, snapshots, and test changes.
LazyDiff keeps the files you need, updates the visible count, and stays local.
Review less. Review better.
Lazy enough to review.""",
            "short-logo": """LazyDiff.
Lazy enough to review.
Hide PR noise before you start.""",
            "short-tease": """Big PR?
Hide generated files, snapshots, and test changes as you like.
Review what matters.""",
            "short-product": """Type a negative filter.
LazyDiff hides matching files, and shows the count left.
All local.""",
        },
    },
    "ja": {
        "pipeline": "j",
        "voice": "jf_alpha",
        "speed": 1,
        "site_video": "lazydiff-promo-ja.mp4",
        "store_video": "lazydiff-promo-v2-long-ja.mp4",
        "audio_dir": AUDIO_ROOT / "ja",
        "copy": {
            "long": """大きな ピーアーはめんどなああ？
ノイズを隠しましょう。
生成ファイル、スナップショット、テスト変更を非表示。
レージーディフ は必要な差分だけを残し、件数も更新します。
すべてローカル。
レビューを、少し楽に。""",
            "short-logo": """レージーディフ。
レビューを、少し楽に。
始める前に、ピーアー のノイズを隠します。""",
            "short-tease": """大きな ピーアーはめんどなああ？
生成ファイル、スナップショット、テスト変更を隠して、
見るべき差分に集中しましょう。""",
            "short-product": """ネガティブフィルターを入力。
一致したファイルを隠し、残りの件数を表示します。
すべてローカルです。""",
        },
    },
}

LONG_SLIDES = [
    "store/video/slides/slide1.png",
    "store/video/slides/slide2.png",
    "store/video/slides/slide3.png",
    "store/video/slides/slide4.png",
]

SHORTS = [
    {
        "slug": "01-logo-tagline",
        "audio": "short-logo",
        "seconds": "5.5",
        "slides": [("store/video/shorts/slides/01-logo.png", "5.5")],
    },
    {
        "slug": "02-tease",
        "audio": "short-tease",
        "seconds": "7.5",
        "slides": [("store/video/shorts/slides/02-tease.png", "7.5")],
    },
    {
        "slug": "03-product-demo",
        "audio": "short-product",
        "seconds": "10.5",
        "slides": [
            ("store/video/shorts/slides/03-product.png", "7.0"),
            ("store/video/shorts/slides/04-final.png", "3.8"),
        ],
    },
]


def run(args: list[str], env: dict[str, str] | None = None) -> None:
    print("\n> " + " ".join(args))
    result = subprocess.run(args, cwd=ROOT, env={**os.environ, **(env or {})})
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def capture(args: list[str]) -> str:
    result = subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def media_duration(path: Path) -> float:
    return float(
        capture(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
        )
    )


def require(paths: list[str]) -> None:
    missing = [path for path in paths if not (ROOT / path).exists()]
    if missing:
        print("Missing input assets:", file=sys.stderr)
        for path in missing:
            print(f"- {path}", file=sys.stderr)
        raise SystemExit(1)


def audio_dir(lang: str) -> Path:
    return LANGUAGES[lang]["audio_dir"]  # type: ignore[return-value]


def print_setup_help() -> None:
    print("Missing .venv-tts Kokoro environment.", file=sys.stderr)
    print("Create/reuse the TTS env before running without --skip-tts.", file=sys.stderr)


def ensure_music_bed() -> None:
    if MUSIC_BED.exists():
        return

    MUSIC_BED.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 48_000
    duration = 10.0
    count = int(sample_rate * duration)
    bpm = 104
    beat = 60 / bpm
    progression = [220.0, 277.18, 329.63, 246.94]
    lead = [440.0, 493.88, 554.37, 659.25, 554.37, 493.88, 440.0, 369.99]

    samples: list[int] = []
    for index in range(count):
        t = index / sample_rate
        x = 0.0

        for step in range(int(duration / beat) + 2):
            dt = t - step * beat
            if 0 <= dt < 0.18:
                env = math.exp(-dt * 24)
                freq = 82 - 28 * min(dt / 0.18, 1)
                x += 0.20 * env * math.sin(2 * math.pi * freq * dt)

        for step in range(int(duration / beat) + 2):
            dt = t - (step * beat + beat * 0.48)
            if 0 <= dt < 0.42:
                root = progression[(step // 2) % len(progression)]
                env = math.exp(-dt * 9.5) * (1 - math.exp(-dt * 80))
                for mult, gain in [(1, 0.18), (1.25, 0.10), (1.5, 0.08), (2, 0.05)]:
                    x += gain * env * math.sin(2 * math.pi * root * mult * dt)
                    x += gain * 0.28 * env * math.sin(2 * math.pi * (root * mult + 1.7) * dt)

        for step in range(int(duration / (beat / 2)) + 2):
            dt = t - (step * (beat / 2) + 0.02)
            if 0 <= dt < 0.035:
                env = math.exp(-dt * 95)
                x += 0.025 * env * math.sin(2 * math.pi * 1550 * dt)

        for step in range(4, int(duration / beat) + 1, 2):
            dt = t - (step * beat + beat * 0.18)
            if 0 <= dt < 0.32:
                freq = lead[(step // 2) % len(lead)]
                env = math.exp(-dt * 11) * (1 - math.exp(-dt * 90))
                x += 0.075 * env * math.sin(2 * math.pi * freq * dt)
                x += 0.025 * env * math.sin(2 * math.pi * freq * 2 * dt)

        fade = max(0.0, min(1.0, t / 0.5, (duration - t) / 0.6))
        x = math.tanh(x * fade * 1.25) * 0.72
        samples.append(int(max(-1.0, min(1.0, x)) * 32767))

    with wave.open(str(MUSIC_BED), "w") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))

    print(f"Generated music bed: {MUSIC_BED.relative_to(ROOT)}")


def generate_voice(lang: str, offline: bool) -> None:
    if not TTS_PYTHON.exists():
        print_setup_help()
        raise SystemExit(1)

    language = LANGUAGES[lang]
    output_dir = audio_dir(lang)
    output_dir.mkdir(parents=True, exist_ok=True)
    env = {
        "VIRTUAL_ENV": str(ROOT / ".venv-tts"),
        "PATH": f"{ROOT / '.venv-tts/bin'}:{os.environ.get('PATH', '')}",
    }
    if offline:
        env["HF_HUB_OFFLINE"] = "1"
        env["TRANSFORMERS_OFFLINE"] = "1"

    code = f"""
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro import KPipeline

audio_dir = Path({str(output_dir)!r})
copy = {language["copy"]!r}
if {lang!r} == "ja":
    import unidic
    import unidic_lite

    unidic.DICDIR = unidic_lite.DICDIR
pipeline = KPipeline(lang_code={language["pipeline"]!r})

for name, text in copy.items():
    chunks = []
    for _, _, audio in pipeline(text, voice={language["voice"]!r}, speed={language["speed"]!r}):
        chunks.append(audio)
    audio = np.concatenate(chunks)
    path = audio_dir / f"{{name}}-v2.wav"
    sf.write(path, audio, 24000)
    print(f"{{path}} {{len(audio) / 24000:.2f}}s", flush=True)
"""
    run([str(TTS_PYTHON), "-c", code], env=env)


def master_audio(lang: str, name: str) -> None:
    directory = audio_dir(lang)
    source = directory / f"{name}-v2.wav"
    if not source.exists():
        print(f"Missing voice WAV: {source.relative_to(ROOT)}", file=sys.stderr)
        print("Run without --skip-tts, or restore the voice WAV first.", file=sys.stderr)
        raise SystemExit(1)

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-stream_loop",
            "-1",
            "-i",
            str(MUSIC_BED),
            "-filter_complex",
            "[0:a]highpass=f=75,acompressor=threshold=-22dB:ratio=1.35:attack=12:release=180,"
            "loudnorm=I=-15:TP=-1.2:LRA=9[voice];"
            "[1:a]highpass=f=45,lowpass=f=5200,volume=0.76[music];"
            "[voice][music]amix=inputs=2:duration=first:weights='1 0.78',"
            "loudnorm=I=-14:TP=-1.0:LRA=9[out]",
            "-map",
            "[out]",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(directory / f"{name}-v2-master.wav"),
        ]
    )


def generate_long_video(lang: str) -> None:
    require(LONG_SLIDES)
    language = LANGUAGES[lang]
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-t",
            "4.4",
            "-i",
            LONG_SLIDES[0],
            "-loop",
            "1",
            "-t",
            "4.1",
            "-i",
            LONG_SLIDES[1],
            "-loop",
            "1",
            "-t",
            "4.1",
            "-i",
            LONG_SLIDES[2],
            "-loop",
            "1",
            "-t",
            "4.1",
            "-i",
            LONG_SLIDES[3],
            "-i",
            str(audio_dir(lang) / "long-v2-master.wav"),
            "-filter_complex",
            "[0:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v0];"
            "[1:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v1];"
            "[2:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v2];"
            "[3:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v3];"
            "[v0][v1]xfade=transition=fade:duration=0.35:offset=4.05[v01];"
            "[v01][v2]xfade=transition=fade:duration=0.35:offset=7.80[v012];"
            "[v012][v3]xfade=transition=fade:duration=0.35:offset=11.55[v];"
            "[4:a]apad[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            "15.5",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "14",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            f"store/video/{language['store_video']}",
        ]
    )


def generate_short_video(lang: str, short: dict[str, object]) -> str:
    slides = short["slides"]  # type: ignore[assignment]
    require([path for path, _ in slides])  # type: ignore[arg-type]

    slug = str(short["slug"])
    audio = audio_dir(lang) / f"{short['audio']}-v2-master.wav"
    seconds_value = max(float(str(short["seconds"])), media_duration(audio) + 0.25)
    seconds = f"{seconds_value:.2f}"
    target = f"store/video/shorts/{slug}-{lang}.mp4"

    args = ["ffmpeg", "-y"]
    if len(slides) == 1:  # type: ignore[arg-type]
        args.extend(["-loop", "1", "-t", seconds, "-i", str(slides[0][0])])  # type: ignore[index]
    else:
        first_path, first_duration = slides[0]  # type: ignore[index]
        second_path, _ = slides[1]  # type: ignore[index]
        second_duration = max(1.0, seconds_value - float(str(first_duration)) + 0.35)
        args.extend(["-loop", "1", "-t", str(first_duration), "-i", str(first_path)])
        args.extend(["-loop", "1", "-t", f"{second_duration:.2f}", "-i", str(second_path)])
    args.extend(["-i", str(audio)])

    if len(slides) == 1:  # type: ignore[arg-type]
        filter_complex = "[0:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v];[1:a]apad[a]"
    else:
        filter_complex = (
            "[0:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v0];"
            "[1:v]fps=30,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v1];"
            "[v0][v1]xfade=transition=fade:duration=0.35:offset=6.65[v];"
            "[2:a]apad[a]"
        )

    args.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            seconds,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "14",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            target,
        ]
    )
    run(args)
    return target


def publish_site_video(lang: str) -> None:
    language = LANGUAGES[lang]
    site_video_dir = ROOT / "site/assets/video"
    site_video_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        ROOT / f"store/video/{language['store_video']}",
        site_video_dir / str(language["site_video"]),
    )
    if lang == "en":
        run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                "1.0",
                "-i",
                "store/video/lazydiff-promo-v2-long.mp4",
                "-frames:v",
                "1",
                "-update",
                "1",
                "site/assets/video/lazydiff-promo-poster.jpg",
            ]
        )


def verify(paths: list[str]) -> None:
    for output in paths:
        if not (ROOT / output).exists():
            continue
        run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration,size:stream=codec_type,codec_name,sample_rate,bit_rate,width,height",
                "-of",
                "compact=p=0:nk=1",
                output,
            ]
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true", help="Allow TTS model downloads.")
    parser.add_argument("--skip-tts", action="store_true", help="Reuse existing voice WAV files.")
    parser.add_argument("--verify-only", action="store_true", help="Only inspect existing videos.")
    parser.add_argument("--only-shorts", action="store_true", help="Only render upload shorts.")
    parser.add_argument("--skip-shorts", action="store_true", help="Only render the long site videos.")
    parser.add_argument("--lang", choices=["en", "ja", "all"], default="en")
    args = parser.parse_args()

    outputs = [
        "store/video/lazydiff-promo-v2-long.mp4",
        "store/video/lazydiff-promo-v2-long-ja.mp4",
        "store/video/shorts/01-logo-tagline-en.mp4",
        "store/video/shorts/02-tease-en.mp4",
        "store/video/shorts/03-product-demo-en.mp4",
        "store/video/shorts/01-logo-tagline-ja.mp4",
        "store/video/shorts/02-tease-ja.mp4",
        "store/video/shorts/03-product-demo-ja.mp4",
    ]
    if args.verify_only:
        verify(outputs)
        return

    ensure_music_bed()
    languages = ["en", "ja"] if args.lang == "all" else [args.lang]

    for lang in languages:
        if not args.skip_tts:
            generate_voice(lang, offline=not args.online)
        names = ["short-logo", "short-tease", "short-product"] if args.only_shorts else [
            "long",
            "short-logo",
            "short-tease",
            "short-product",
        ]
        for name in names:
            master_audio(lang, name)
        if not args.only_shorts:
            generate_long_video(lang)
            publish_site_video(lang)
        if not args.skip_shorts:
            for short in SHORTS:
                generate_short_video(lang, short)

    verify(outputs)


if __name__ == "__main__":
    main()
