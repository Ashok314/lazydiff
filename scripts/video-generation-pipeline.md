# Code-generated video pipeline

This repo keeps the LazyDiff demo video generator in:

`scripts/generate_promo_videos.py`

It is local tooling for the demo assets. The website only needs the final MP4
files under `site/assets/video/`.

## LazyDiff generator

Useful commands:

```sh
# Generate English from cached/local TTS models.
.venv-tts/bin/python scripts/generate_promo_videos.py

# Generate English and Japanese.
.venv-tts/bin/python scripts/generate_promo_videos.py --lang all

# Reuse existing voice WAV files and only remaster/mux.
.venv-tts/bin/python scripts/generate_promo_videos.py --lang all --skip-tts

# Inspect existing generated MP4 files.
.venv-tts/bin/python scripts/generate_promo_videos.py --verify-only
```

The script has four stages:

1. Voice generation
   - Uses Kokoro TTS through `.venv-tts`.
   - Writes WAV files under `store/video/neural-audio/v2/`.
   - Supports English and Japanese copy.

2. Background bed
   - Generates a simple local WAV at:
     `store/video/music/generated/e2-warm-no-drone-bed.wav`
   - No external music sample is required.

3. Audio mastering
   - Uses ffmpeg filters for high-pass cleanup, compression, music volume,
     voice/music mixing, and loudness normalization.

4. Video muxing
   - Builds the long demo from PNG frames in `store/video/slides/`.
   - Adds soft frame transitions with `xfade`.
   - Optionally replaces audio on short MP4 variants.
   - Publishes website copies to `site/assets/video/`.

## What is reusable

For a separate educational-video project, keep the same architecture but replace
the LazyDiff-specific inputs:

- Frame generator:
  Generate PNG frames from code, SVG, canvas, PIL, Manim, or HTML screenshots.

- Script/copy source:
  Store the lesson text as structured data:
  topic, scenes, narration, visual instructions, duration.

- Audio generator:
  Use Kokoro or another local/free TTS engine to write narration WAV files.

- Music generator:
  Generate a simple local bed with code, or use only CC0/public-domain assets.

- Mixer:
  Reuse the ffmpeg mastering chain, with per-project voice/music levels.

- Renderer:
  Turn scene frames plus audio into MP4 with `ffmpeg`.

## Pure-code educational video idea

Memo:

```text
AI generated educational video
- like draw
- abcd
- with audio
Simple Python script to generate
```

A good first generic version:

```text
lesson.json
  title
  language
  scenes[]
    duration
    narration
    frame_type
    frame_data

generate.py
  read lesson.json
  generate frames
  generate voice
  generate music bed
  mix audio
  render mp4
```

The important split is: scene data decides what to teach; renderers decide how
to draw it. That keeps the system useful for ABC lessons, diagrams, product
demos, or short explainers without rewriting the pipeline.
