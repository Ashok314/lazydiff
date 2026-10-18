#!/usr/bin/env python3
"""Generate YouTube thumbnails for LazyDiff short videos.

Requires ImageMagick's `magick` binary. Outputs 1280x720 RGB PNG files under:

store/youtube/shorts/creative/
"""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store/youtube/shorts/creative"
TMP = Path("/tmp/lazydiff-yt-shorts")

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_JA = "/System/Library/Fonts/Hiragino Sans GB.ttc"


def run(args: list[str]) -> None:
    print("> " + " ".join(args))
    subprocess.run(args, cwd=ROOT, check=True)


def magick(*args: str) -> None:
    run(["magick", *args])


def prepare() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)

    magick(
        "site/assets/screenshots/before.png",
        "-crop",
        "2100x1320+820+700",
        "-resize",
        "740x465^",
        "-gravity",
        "center",
        "-extent",
        "740x465",
        str(TMP / "before-crop.png"),
    )
    magick(
        "site/assets/screenshots/after.png",
        "-crop",
        "2100x1320+820+700",
        "-resize",
        "740x465^",
        "-gravity",
        "center",
        "-extent",
        "740x465",
        str(TMP / "after-crop.png"),
    )
    magick(
        "site/assets/screenshots/closeup.png",
        "-resize",
        "1050x196^",
        "-gravity",
        "center",
        "-extent",
        "1050x196",
        str(TMP / "closeup-wide.png"),
    )


def logo_thumbnail(lang: str) -> None:
    ja = lang == "ja"
    title_1 = "レビュー" if ja else "LAZY"
    title_2 = "楽に" if ja else "ENOUGH"
    sub = "LazyDiff" if ja else "to review"
    font = FONT_JA if ja else FONT_BLACK
    sub_font = FONT_JA if ja else FONT_BOLD

    magick(
        "store/video/shorts/slides/01-logo.png",
        "-resize",
        "1280x720!",
        "-fill",
        "rgba(16,24,32,0.88)",
        "-draw",
        "polygon 0,0 480,0 360,720 0,720",
        "-fill",
        "#22a447",
        "-draw",
        "polygon 0,0 32,0 32,720 0,720",
        "-font",
        font,
        "-fill",
        "#ffffff",
        "-pointsize",
        "64" if ja else "70",
        "-annotate",
        "+68+194",
        title_1,
        "-annotate",
        "+68+284",
        title_2,
        "-font",
        sub_font,
        "-fill",
        "#dff7e7",
        "-pointsize",
        "34" if ja else "36",
        "-annotate",
        "+72+356",
        sub,
        "-fill",
        "#22a447",
        "-draw",
        "roundrectangle 72,438 370,510 18,18",
        "-fill",
        "#ffffff",
        "-pointsize",
        "31",
        "-annotate",
        "+102+486",
        "SHORT 01",
        "-alpha",
        "off",
        "-depth",
        "8",
        f"PNG24:{OUT / f'01-logo-tagline-{lang}-thumbnail.png'}",
    )


def tease_thumbnail(lang: str) -> None:
    ja = lang == "ja"
    top = "ノイズを隠す" if ja else "HIDE NOISE"
    bottom = "レビュー軽く" if ja else "REVIEW LESS"
    font = FONT_JA if ja else FONT_BLACK

    magick(
        "store/video/shorts/slides/02-tease.png",
        "-resize",
        "1280x720!",
        "-fill",
        "rgba(232,62,77,0.94)",
        "-draw",
        "roundrectangle 58,70 520,165 18,18",
        "-font",
        font,
        "-fill",
        "#ffffff",
        "-pointsize",
        "43" if ja else "48",
        "-annotate",
        "+88+133",
        top,
        "-fill",
        "rgba(34,164,71,0.94)",
        "-draw",
        "roundrectangle 706,548 1218,642 18,18",
        "-fill",
        "#ffffff",
        "-pointsize",
        "43" if ja else "45",
        "-annotate",
        "+744+611" if ja else "+738+611",
        bottom,
        "-fill",
        "#101820",
        "-draw",
        "roundrectangle 506,282 774,404 22,22",
        "-fill",
        "#ffffff",
        "-font",
        FONT_BOLD,
        "-pointsize",
        "50",
        "-annotate",
        "+560+360",
        "with !",
        "-alpha",
        "off",
        "-depth",
        "8",
        f"PNG24:{OUT / f'02-tease-{lang}-thumbnail.png'}",
    )


def product_thumbnail(lang: str) -> None:
    ja = lang == "ja"
    title = "残った差分だけ" if ja else "ONLY WHAT IS LEFT"
    count = "残り9件" if ja else "9 LEFT"
    font = FONT_JA if ja else FONT_BLACK

    magick(
        "store/video/shorts/slides/03-product.png",
        "-resize",
        "1280x720!",
        "-fill",
        "rgba(255,255,255,0.92)",
        "-draw",
        "roundrectangle 42,42 706,170 24,24",
        "-font",
        font,
        "-fill",
        "#101820",
        "-pointsize",
        "50" if ja else "52",
        "-annotate",
        "+72+122",
        title,
        "-fill",
        "#22a447",
        "-draw",
        "roundrectangle 78,500 425,606 22,22",
        "-fill",
        "#ffffff",
        "-pointsize",
        "50" if ja else "54",
        "-annotate",
        "+112+572",
        count,
        "-fill",
        "#101820",
        "-draw",
        "roundrectangle 760,500 1206,606 22,22",
        "-fill",
        "#ffffff",
        "-font",
        FONT_BOLD,
        "-pointsize",
        "34",
        "-annotate",
        "+792+565",
        "!*.test.ts  !dist/**",
        "-alpha",
        "off",
        "-depth",
        "8",
        f"PNG24:{OUT / f'03-product-demo-{lang}-thumbnail.png'}",
    )


def contact_sheet() -> None:
    magick(
        str(OUT / "01-logo-tagline-en-thumbnail.png"),
        str(OUT / "01-logo-tagline-ja-thumbnail.png"),
        str(OUT / "02-tease-en-thumbnail.png"),
        "-resize",
        "426x240",
        "-background",
        "#f3f4f6",
        "-gravity",
        "center",
        "-extent",
        "426x240",
        "+append",
        str(TMP / "contact-row-1.png"),
    )
    magick(
        str(OUT / "02-tease-ja-thumbnail.png"),
        str(OUT / "03-product-demo-en-thumbnail.png"),
        str(OUT / "03-product-demo-ja-thumbnail.png"),
        "-resize",
        "426x240",
        "-background",
        "#f3f4f6",
        "-gravity",
        "center",
        "-extent",
        "426x240",
        "+append",
        str(TMP / "contact-row-2.png"),
    )
    magick(str(TMP / "contact-row-1.png"), str(TMP / "contact-row-2.png"), "-append", str(OUT / "contact-sheet.png"))


def main() -> None:
    prepare()
    for lang in ("en", "ja"):
        logo_thumbnail(lang)
        tease_thumbnail(lang)
        product_thumbnail(lang)
    contact_sheet()


if __name__ == "__main__":
    main()
