"""Rift Daily's brand assets, drawn from code so they can be redrawn at any size.

    python3 brand/make_brand.py            # writes brand/out/*.png

The mark: a hextech hexagon split by a glowing rift crack - its rim cyan on one side, gold on the other - with a
play button in the middle (a clips channel from the Rift). Colours and fonts: brand/BRAND.md.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
FONTS = HERE / "fonts"

NAVY = (10, 15, 30)          # Rift Night
NAVY_2 = (19, 32, 58)        # its lighter centre
CYAN = (24, 230, 255)        # Rift Cyan, the primary
GOLD = (245, 197, 66)        # Hextech Gold, the accent
WHITE = (244, 247, 255)
MIST = (160, 178, 210)       # secondary text on navy


def font(name: str, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), max(4, int(round(size))))


def rounded(mask: Image.Image, r: float) -> Image.Image:
    """Round a convex shape's corners: blur, then threshold back at the middle."""
    if r <= 0:
        return mask
    return mask.filter(ImageFilter.GaussianBlur(r)).point(lambda v: 255 if v >= 128 else 0)


def smooth_down(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.LANCZOS) if im.width != size else im


def hexagon(c: float, r: float, rot: float = -90.0) -> list[tuple[float, float]]:
    return [(c + r * math.cos(math.radians(rot + 60 * i)), c + r * math.sin(math.radians(rot + 60 * i)))
            for i in range(6)]


def lin_gradient(size: int, a, b, angle: float = 90.0) -> np.ndarray:
    """RGB float array: colour a to b along `angle` degrees (90 = top to bottom)."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / max(1, size - 1)
    t = np.clip(x * math.cos(math.radians(angle)) + y * math.sin(math.radians(angle)), 0, 1)
    t = (t - t.min()) / max(1e-6, t.max() - t.min())
    a, b = np.array(a, np.float32), np.array(b, np.float32)
    return a + (b - a) * t[..., None]


def layer(rgb: np.ndarray, alpha: Image.Image) -> Image.Image:
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    im.putalpha(alpha)
    return im


def mark(size: int = 1024, ss: int = 2) -> Image.Image:
    """The mark alone on transparency, `size` px square (drawn `ss` times bigger, then reduced)."""
    S = size * ss
    c, R = S / 2, S * 0.44
    # the crack: top-right to bottom-left across the badge, jagged; its two sides take the two colours
    crack = [(0.66, -1.20), (0.30, -0.46), (0.42, -0.30), (0.02, 0.14), (0.16, 0.26), (-0.18, 0.62), (-0.52, 1.20)]
    pts = [(c + x * R, c + y * R) for x, y in crack]
    side_a = Image.new("L", (S, S), 0)  # the top-left side of the crack
    ImageDraw.Draw(side_a).polygon(pts + [(0, S), (0, 0), (pts[0][0], 0)], fill=255)
    gap = Image.new("L", (S, S), 0)
    ImageDraw.Draw(gap).line(pts, fill=255, width=int(R * 0.075), joint="curve")
    # the badge: a rounded hexagon, its rim around a navy face
    outer = rounded(Image.new("L", (S, S), 0), 0)
    ImageDraw.Draw(outer).polygon(hexagon(c, R), fill=255)
    outer = rounded(outer, R * 0.05)
    inner = Image.new("L", (S, S), 0)
    ImageDraw.Draw(inner).polygon(hexagon(c, R * 0.83), fill=255)
    inner = rounded(inner, R * 0.04)
    rim = Image.fromarray(np.clip(np.asarray(outer, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8))
    # the play button, a touch right of centre (its optical middle)
    tri = Image.new("L", (S, S), 0)
    ImageDraw.Draw(tri).polygon([(c - 0.27 * R, c - 0.37 * R), (c - 0.27 * R, c + 0.37 * R), (c + 0.40 * R, c)],
                                fill=255)
    tri = rounded(tri, R * 0.035)

    def cut(m: Image.Image, half: Image.Image) -> Image.Image:
        a = np.asarray(m, np.float32) * (np.asarray(half, np.float32) / 255) * (1 - np.asarray(gap, np.float32) / 255)
        return Image.fromarray(a.astype(np.uint8))

    side_b = Image.fromarray(255 - np.asarray(side_a))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # a soft glow round the whole badge, cyan up top, gold below
    glow = outer.filter(ImageFilter.GaussianBlur(R * 0.12)).point(lambda v: int(v * 0.55))
    out.alpha_composite(layer(lin_gradient(S, CYAN, GOLD, 60), glow))
    face = layer(lin_gradient(S, NAVY_2, NAVY, 90), inner)
    out.alpha_composite(face)
    # the face's own inner light along the crack
    shine = gap.filter(ImageFilter.GaussianBlur(R * 0.16))
    shine = Image.fromarray((np.asarray(shine, np.float32) * (np.asarray(inner, np.float32) / 255) * 0.85).astype(np.uint8))
    out.alpha_composite(layer(np.broadcast_to(np.array(CYAN, np.float32), (S, S, 3)).copy(), shine))
    # the rim: cyan on the crack's top-left side, gold on its bottom-right, each lit from its outer edge
    out.alpha_composite(layer(lin_gradient(S, (150, 245, 255), CYAN, 120), cut(rim, side_a)))
    out.alpha_composite(layer(lin_gradient(S, (255, 226, 140), (226, 160, 40), 120), cut(rim, side_b)))
    # the play button's two halves, the bottom one nudged down-right (the tear)
    out.alpha_composite(layer(lin_gradient(S, (255, 255, 255), (214, 236, 255), 90), cut(tri, side_a)))
    half_b = layer(lin_gradient(S, (255, 252, 240), (255, 228, 170), 90), cut(tri, side_b))
    out.alpha_composite(half_b, (int(R * 0.018), int(R * 0.018)))
    # the crack's light: a white-hot core in a cyan glow, kept just inside the badge
    keep = outer.filter(ImageFilter.MaxFilter(int(R * 0.06) | 1))
    core = Image.new("L", (S, S), 0)
    ImageDraw.Draw(core).line(pts, fill=255, width=max(2, int(R * 0.022)), joint="curve")
    halo = core.filter(ImageFilter.GaussianBlur(R * 0.045))
    k = np.asarray(keep, np.float32) / 255
    halo = Image.fromarray(np.clip(np.asarray(halo, np.float32) * 2.2 * k, 0, 255).astype(np.uint8))
    core = Image.fromarray((np.asarray(core, np.float32) * k).astype(np.uint8))
    out.alpha_composite(layer(np.broadcast_to(np.array(CYAN, np.float32), (S, S, 3)).copy(), halo))
    out.alpha_composite(layer(np.broadcast_to(np.array((235, 255, 255), np.float32), (S, S, 3)).copy(), core))
    return smooth_down(out, size)


def avatar(size: int = 800) -> Image.Image:
    """The profile picture: the mark on Rift Night, inside the circle every platform crops it to."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.hypot(x - size / 2, y - size / 2) / (size / 2)
    bg = np.array(NAVY_2, np.float32) + (np.array(NAVY, np.float32) - np.array(NAVY_2, np.float32)) * np.clip(d, 0, 1)[..., None]
    im = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")
    m = mark(int(size * 0.80))
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2 + int(size * 0.01)))
    return im.convert("RGB")


def wordmark(height: int, rift=WHITE, daily=CYAN) -> Image.Image:
    """RIFT DAILY in Chakra Petch Bold Italic, `height` px cap height, tight."""
    f = font("ChakraPetch-BoldItalic.ttf", height * 1.38)
    t1, t2 = "RIFT", "DAILY"
    space = f.getlength(" ") * 0.7
    w = int(f.getlength(t1) + space + f.getlength(t2)) + 40
    _, top, _, bot = f.getbbox("RIFTDAILY")
    im = Image.new("RGBA", (w, bot - top + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((20, 10 - top), t1, font=f, fill=rift)
    d.text((20 + f.getlength(t1) + space, 10 - top), t2, font=f, fill=daily)
    return im.crop(im.getbbox())


def shadowed(im: Image.Image, r: float, k: float = 0.7, dy: int = 0) -> Image.Image:
    pad = int(r * 3) + abs(dy)
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    a = Image.new("L", out.size, 0)
    a.paste(im.getchannel("A"), (pad, pad + dy))
    sh.putalpha(a.filter(ImageFilter.GaussianBlur(r)).point(lambda v: int(v * k)))
    out.alpha_composite(sh)
    out.alpha_composite(im, (pad, pad))
    return out


def hex_grid(w: int, h: int, cell: float, color, alpha: int) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dx, dy = cell * math.sqrt(3), cell * 1.5
    for row in range(int(h / dy) + 2):
        for col in range(int(w / dx) + 2):
            cx = col * dx + (dx / 2 if row % 2 else 0)
            cy = row * dy
            d.polygon(hexagon(0, cell, -90), outline=None)
            pts = [(cx + x, cy + y) for x, y in hexagon(0, cell * 0.96, -90)]
            d.line(pts + [pts[0]], fill=color + (alpha,), width=2)
    return im


def banner(w: int = 2560, h: int = 1440) -> Image.Image:
    """YouTube's channel art: everything that matters inside the 1546 x 423 middle every device shows."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    bg = np.array(NAVY_2, np.float32) + (np.array(NAVY, np.float32) - np.array(NAVY_2, np.float32)) * np.clip(d * 0.9, 0, 1)[..., None]
    im = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")
    grid = hex_grid(w, h, 46, CYAN, 16)
    fade = np.clip(1.15 - d, 0, 1) ** 1.5
    ga = (np.asarray(grid.getchannel("A"), np.float32) * fade).astype(np.uint8)
    grid.putalpha(Image.fromarray(ga))
    im.alpha_composite(grid)
    # the rift: a long diagonal streak of light behind everything, cyan into gold
    streak = Image.new("L", (w, h), 0)
    ImageDraw.Draw(streak).line([(w * 0.70, -40), (w * 0.52, h * 0.42), (w * 0.57, h * 0.50), (w * 0.36, h + 40)],
                                fill=255, width=10, joint="curve")
    wide = streak.filter(ImageFilter.GaussianBlur(60)).point(lambda v: min(255, int(v * 2.6)))
    im.alpha_composite(layer(lin_gradient(w, CYAN, GOLD, 90)[:h, :w], wide.point(lambda v: int(v * 0.55))))
    im.alpha_composite(layer(np.broadcast_to(np.array((210, 250, 255), np.float32), (h, w, 3)).copy(),
                             streak.filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.5))))
    # the safe middle: the mark and the name, centred in it
    sx0, sy0, sw, sh = (w - 1546) // 2, (h - 423) // 2, 1546, 423
    m = mark(380)
    wm = shadowed(wordmark(140), 14, 0.8, 6)
    pad_wm = 14 * 3 + 6  # the shadow's own margin round the name
    total = m.width + 40 + wm.width - 2 * pad_wm
    mx = sx0 + (sw - total) // 2
    im.alpha_composite(m, (mx, sy0 + (sh - m.height) // 2))
    im.alpha_composite(wm, (mx + m.width + 40 - pad_wm, sy0 + (sh - (wm.height - 2 * pad_wm)) // 2 - pad_wm))
    return im.convert("RGB")


def watermark(size: int = 150) -> Image.Image:
    """YouTube's video watermark (Studio > Customisation > Branding): the mark, a dark edge so it reads on snow."""
    m = mark(int(size * 0.86))
    return shadowed(m, size * 0.03, 0.85).resize((size, size), Image.LANCZOS)


def corner_bug(height: int = 72) -> Image.Image:
    """The small brand mark for the top of every short: the mark and the name, white, shadowed."""
    m = mark(height)
    wm = wordmark(int(height * 0.42), WHITE, WHITE)
    w = m.width + 14 + wm.width
    im = Image.new("RGBA", (w, height), (0, 0, 0, 0))
    im.alpha_composite(m, (0, 0))
    im.alpha_composite(wm, (m.width + 14, (height - wm.height) // 2))
    return shadowed(im, 6, 0.75, 2)


def credit_pill(handle: str = "twitch.tv/streamer", scale: float = 1.0) -> Image.Image:
    """How a clip's creator is credited on screen: a dark pill, a cyan edge, CLIP in gold, the channel in white."""
    fl, fh = font("ChakraPetch-Bold.ttf", 30 * scale), font("Inter-ExtraBold.ttf", 36 * scale)
    lab = "CLIP"
    h = int(68 * scale)
    w = int(24 * scale + fl.getlength(lab) + 16 * scale + fh.getlength(handle) + 30 * scale)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=NAVY + (225,))
    d.rounded_rectangle([0, 0, int(10 * scale), h - 1], radius=int(5 * scale), fill=CYAN + (255,))
    x = int(24 * scale)
    d.text((x, h / 2), lab, font=fl, fill=GOLD, anchor="lm")
    x += int(fl.getlength(lab) + 16 * scale)
    d.text((x, h / 2), handle, font=fh, fill=WHITE, anchor="lm")
    return shadowed(im, 8, 0.6, 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mark(2048).save(OUT / "rift-daily-mark-2048.png")
    mark(512).save(OUT / "rift-daily-mark-512.png")
    avatar(800).save(OUT / "rift-daily-avatar-800.png")
    avatar(400).save(OUT / "rift-daily-avatar-400.png")
    banner().save(OUT / "rift-daily-youtube-banner-2560x1440.png")
    watermark().save(OUT / "rift-daily-youtube-watermark-150.png")
    corner_bug().save(OUT / "rift-daily-corner-bug.png")
    credit_pill().save(OUT / "rift-daily-credit-pill-sample.png")
    wm = wordmark(240)
    wm.save(OUT / "rift-daily-wordmark.png")
    print("written:", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
