"""Four other looks for Rift Daily, drawn side by side so the owner can pick one (2026-11-03: "give me other
logo/rest of the design options, dont like those").

    python3 brand/options.py [1] [2]   # boards in work/brand_options/. Round 1: A Sticker, B Broadcast, C Arcade,
                                       # D Street. Round 2: B2 Night Game, B3 Championship, B4 Daylight (like B),
                                       # E Chrome, F Mono, G Esports

Each look draws its avatar, wordmark, banner and the short's overlays (credit, tag, captions, hook) on the same
frame of the Peyz short. Fonts (Google Fonts, OFL/Apache) download to build/fonts/ on first run.
"""
from __future__ import annotations

import math
import random
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "work/brand_options"
FONT_DIR = ROOT / "build/fonts"
FONTS = {
    "lilita": "ofl/lilitaone/LilitaOne-Regular.ttf",
    "montserrat": "ofl/montserrat/Montserrat%5Bwght%5D.ttf",
    "anton": "ofl/anton/Anton-Regular.ttf",
    "barlow_black": "ofl/barlow/Barlow-Black.ttf",
    "barlow_bold": "ofl/barlow/Barlow-Bold.ttf",
    "barlow_sc": "ofl/barlowsemicondensed/BarlowSemiCondensed-SemiBold.ttf",
    "bungee": "ofl/bungee/Bungee-Regular.ttf",
    "press": "ofl/pressstart2p/PressStart2P-Regular.ttf",
    "marker": "apache/permanentmarker/PermanentMarker-Regular.ttf",
    "archivo": "ofl/archivoblack/ArchivoBlack-Regular.ttf",
}


def font(key: str, size: float, weight: str | None = None) -> ImageFont.FreeTypeFont:
    path = FONT_DIR / Path(FONTS[key].replace("%5B", "[").replace("%5D", "]")).name
    if not path.exists():
        FONT_DIR.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve("https://raw.githubusercontent.com/google/fonts/main/" + FONTS[key], path)
    f = ImageFont.truetype(str(path), max(6, int(round(size))))
    if weight:
        f.set_variation_by_name(weight)
    return f


# -- drawing helpers -----------------------------------------------------------------------------------------------

def text(t: str, f, fill, stroke: int = 0, stroke_fill=(0, 0, 0), spacing: float = 0.0) -> Image.Image:
    """One line of text, tight, on transparent; `spacing` adds letter spacing as a share of the size."""
    pad = stroke + 8
    if spacing:
        widths = [f.getlength(c) for c in t]
        extra = f.size * spacing
        w = int(sum(widths) + extra * (len(t) - 1)) + 2 * pad
    else:
        w = int(f.getlength(t)) + 2 * pad
    asc, desc = f.getmetrics()
    im = Image.new("RGBA", (w, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if spacing:
        x = pad
        for c, cw in zip(t, widths):
            d.text((x, pad), c, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
            x += cw + extra
    else:
        d.text((pad, pad), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    box = im.getbbox()
    return im.crop(box) if box else im


def stack(parts: list[Image.Image], gap: int = 0, align: str = "c") -> Image.Image:
    w = max(p.width for p in parts)
    h = sum(p.height for p in parts) + gap * (len(parts) - 1)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 0
    for p in parts:
        x = (w - p.width) // 2 if align == "c" else 0 if align == "l" else w - p.width
        im.alpha_composite(p, (x, y))
        y += p.height + gap
    return im


def row(parts: list[Image.Image], gap: int = 0) -> Image.Image:
    w = sum(p.width for p in parts) + gap * (len(parts) - 1)
    h = max(p.height for p in parts)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    for p in parts:
        im.alpha_composite(p, (x, (h - p.height) // 2))
        x += p.width + gap
    return im


def grow(im: Image.Image, r: float, color) -> Image.Image:
    """A solid outline of `r` px around the shape (a sticker border), under it."""
    pad = int(r) + 4
    a = Image.new("L", (im.width + 2 * pad, im.height + 2 * pad), 0)
    a.paste(im.getchannel("A"), (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(r / 2)).point(lambda v: 255 if v > 12 else 0)
    a = a.filter(ImageFilter.GaussianBlur(1.2))
    out = Image.new("RGBA", a.size, color + (0,))
    out.putalpha(a)
    out.alpha_composite(im, (pad, pad))
    return out


def hard_shadow(im: Image.Image, dx: int, dy: int, color, blur: float = 0) -> Image.Image:
    out = Image.new("RGBA", (im.width + abs(dx) + 4, im.height + abs(dy) + 4), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, color + (0,))
    a = im.getchannel("A")
    if blur:
        a = a.filter(ImageFilter.GaussianBlur(blur))
    sh.putalpha(a)
    out.alpha_composite(sh, (max(dx, 0), max(dy, 0)))
    out.alpha_composite(im, (max(-dx, 0), max(-dy, 0)))
    return out


def soft_shadow(im: Image.Image, r: float, k: float = 0.6, dy: int = 4) -> Image.Image:
    pad = int(r * 3) + abs(dy)
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    a = Image.new("L", out.size, 0)
    a.paste(im.getchannel("A"), (pad, pad + dy))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sh.putalpha(a.filter(ImageFilter.GaussianBlur(r)).point(lambda v: int(v * k)))
    out.alpha_composite(sh)
    out.alpha_composite(im, (pad, pad))
    return out


def rotate(im: Image.Image, deg: float) -> Image.Image:
    return im.rotate(deg, resample=Image.BICUBIC, expand=True)


def fill_gradient(im: Image.Image, stops: list[tuple[float, tuple]]) -> Image.Image:
    """Recolour a shape top to bottom through `stops` [(0..1, rgb)], keeping its alpha."""
    h = im.height
    ys = np.linspace(0, 1, h)
    cols = np.zeros((h, 3), np.float32)
    for c in range(3):
        cols[:, c] = np.interp(ys, [s for s, _ in stops], [col[c] for _, col in stops])
    rgb = np.repeat(cols[:, None, :], im.width, axis=1).astype(np.uint8)
    out = Image.fromarray(rgb, "RGB").convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def scanlines(im: Image.Image, every: int = 4, k: float = 0.22) -> Image.Image:
    a = np.asarray(im).copy()
    a[::every, :, :3] = (a[::every, :, :3] * (1 - k)).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def glow(im: Image.Image, color, r: float, k: float = 0.9) -> Image.Image:
    pad = int(r * 2.5)
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    a = Image.new("L", out.size, 0)
    a.paste(im.getchannel("A"), (pad, pad))
    g = Image.new("RGBA", out.size, color + (0,))
    g.putalpha(a.filter(ImageFilter.GaussianBlur(r)).point(lambda v: min(255, int(v * k * 1.6))))
    out.alpha_composite(g)
    out.alpha_composite(im, (pad, pad))
    return out


def halftone(w: int, h: int, bg, dot, spacing: int, cx: float, cy: float, rmax: float) -> Image.Image:
    im = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(im)
    diag = math.hypot(w, h)
    for y in range(0, h + spacing, spacing):
        off = spacing / 2 if (y // spacing) % 2 else 0
        for x in range(-spacing, w + spacing, spacing):
            xx = x + off
            k = 1 - math.hypot(xx - cx, y - cy) / diag
            r = rmax * max(0.0, k) ** 2
            if r > 0.6:
                d.ellipse([xx - r, y - r, xx + r, y + r], fill=dot)
    return im


def paper(w: int, h: int, base, seed: int = 3) -> Image.Image:
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 7, (h // 2 + 1, w // 2 + 1)).astype(np.float32)
    n = np.asarray(Image.fromarray(n).resize((w, h), Image.BICUBIC))
    arr = np.clip(np.array(base, np.float32)[None, None, :] + n[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def circle(im: Image.Image) -> Image.Image:
    s = im.width
    m = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    out = im.convert("RGBA")
    out.putalpha(m.resize((s, s), Image.LANCZOS))
    return out


def place(base: Image.Image, im: Image.Image, x: float, y: float, anchor: str = "lt") -> None:
    ax = {"l": 0, "c": im.width / 2, "r": im.width}[anchor[0]]
    ay = {"t": 0, "m": im.height / 2, "b": im.height}[anchor[1]]
    base.alpha_composite(im, (int(round(x - ax)), int(round(y - ay))))


def fit(im: Image.Image, w: int | None = None, h: int | None = None) -> Image.Image:
    s = min(w / im.width if w else 1e9, h / im.height if h else 1e9)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)


# -- the shared short frame ----------------------------------------------------------------------------------------

CAM_H, W, H = 600, 1080, 1920
HOOK = ("PEYZ ONE-SHOTS JAX", "THROUGH A GROMP")
CAPTION = ["WHAT", "THE", "F**K"]
ACTIVE = 2
CREDIT = "twitch.tv/midbeast"


def base_frame() -> Image.Image:
    cached = OUT / "base_frame.png"
    if cached.exists():
        return Image.open(cached).convert("RGBA")
    sys.path.insert(0, str(ROOT))
    import json
    import cv2
    from rift import short
    r = short.load(ROOT / "shorts/2026-11-03-peyz-gromp.json")
    cap = cv2.VideoCapture(str(ROOT / r["source"]))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(4.15 * cap.get(cv2.CAP_PROP_FPS)))
    ok, f = cap.read()
    pw, ph = short.panel_size(True)
    canvas = short.compose(short.crop(f, r["cam"]), short.crop(f, short.fit_crop(r["game"], pw / ph)))
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(canvas[..., ::-1]).convert("RGBA")
    im.save(cached)
    return im


# -- A: sticker ----------------------------------------------------------------------------------------------------

class Sticker:
    key, name = "A", "Sticker"
    pitch = "Loud and TikTok-native: a die-cut sticker logo, hazard yellow and punch pink, chunky rounded type."
    YELLOW, INK, WHITE, PINK, PINK_D = (255, 214, 10), (17, 17, 17), (255, 255, 255), (255, 61, 127), (222, 34, 104)
    palette = [("Hazard Yellow", YELLOW), ("Punch Pink", PINK), ("Ink", INK), ("White", WHITE)]
    fonts = "Lilita One · Montserrat Black"

    def sticker(self, lines, size, fills=None, tilt=-6.0, border=None, gap=-0.16):
        fills = fills or [self.YELLOW] * len(lines)
        f = font("lilita", size)
        parts = [text(t, f, c, stroke=int(size * 0.085), stroke_fill=self.INK) for t, c in zip(lines, fills)]
        im = stack(parts, gap=int(size * gap))
        im = grow(im, border or size * 0.11, self.WHITE)
        im = hard_shadow(im, int(size * 0.05), int(size * 0.07), self.INK)
        return rotate(im, tilt)

    def wordmark(self, h=240):
        return self.sticker(["RIFT DAILY"], h)

    def avatar(self, s=800):
        bg = halftone(s, s, self.PINK, self.PINK_D, int(s * 0.045), s * 0.85, s * 0.9, s * 0.03).convert("RGBA")
        st = fit(self.sticker(["RIFT", "DAILY"], s * 0.3), w=int(s * 0.74))
        place(bg, st, s / 2, s / 2, "cm")
        return bg.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = halftone(bw, bh, self.PINK, self.PINK_D, 44, bw * 0.75, bh * 0.85, 13).convert("RGBA")
        st = fit(self.sticker(["RIFT", "DAILY"], 300), h=380)
        place(im, st, 540, 720, "lm")
        tape = self.tape("LEAGUE'S BEST CLIPS · EVERY DAY", 54, self.INK, self.YELLOW, tilt=-2.5)
        place(im, tape, 540 + st.width + 40, 650, "lm")
        tape2 = self.tape("OUTPLAYS · PENTAS · THROWS", 40, self.YELLOW, self.INK, tilt=1.5)
        place(im, tape2, 540 + st.width + 70, 790, "lm")
        return im.convert("RGB")

    def tape(self, t, size, bg, fg, tilt=-2.0):
        f = font("montserrat", size, "Black")
        tx = text(t, f, fg)
        pw, ph = tx.width + int(size * 1.0), tx.height + int(size * 0.7)
        im = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        rng = random.Random(7)
        teeth = lambda x0, s: [(x0 + s * rng.uniform(0, size * 0.18), y) for y in np.linspace(0, ph, 7)]  # noqa: E731
        left = teeth(0, 1)
        right = [(pw - 1 - (x - 0), y) for x, y in teeth(0, 1)][::-1]
        d.polygon(left + right, fill=bg + (255,))
        im.alpha_composite(tx, ((pw - tx.width) // 2, (ph - tx.height) // 2))
        return rotate(hard_shadow(im, 6, 8, self.INK if bg != self.INK else (0, 0, 0)), tilt)

    def overlay(self, frame: Image.Image) -> Image.Image:
        im = frame.copy()
        ImageDraw.Draw(im).rectangle([0, CAM_H - 5, W, CAM_H + 5], fill=self.INK)
        tag = fit(self.sticker(["RIFT DAILY"], 70, tilt=-6), h=86)
        place(im, tag, 22, CAM_H, "lm")
        cred = fit(self.tape("CLIP: " + CREDIT, 34, self.YELLOW, self.INK, tilt=2), h=86)
        place(im, cred, W - 18, CAM_H, "rm")
        f = font("montserrat", 84, "Black")
        words = [text(w, f, self.YELLOW if i == ACTIVE else self.WHITE, stroke=10, stroke_fill=self.INK)
                 for i, w in enumerate(CAPTION)]
        place(im, row(words, gap=18), W / 2, CAM_H - 112, "cm")
        hook = self.sticker(list(HOOK), 92, fills=[self.WHITE, self.YELLOW], tilt=-3, border=9, gap=0.02)
        place(im, fit(hook, w=1000), W / 2, CAM_H + 72, "ct")
        return im


# -- B: broadcast --------------------------------------------------------------------------------------------------

class Broadcast:
    key, name = "B", "Broadcast"
    pitch = "Clean and premium, like a sports network: an RD monogram tile, carbon and signal orange, tall condensed type."
    CARBON, CARBON2, WHITE, SIGNAL, SLATE = (14, 14, 16), (30, 30, 35), (245, 245, 242), (255, 79, 31), (138, 143, 152)
    palette = [("Signal", SIGNAL), ("Carbon", CARBON), ("Bone", WHITE), ("Slate", SLATE)]
    fonts = "Anton · Barlow"

    def tile(self, s):
        k = 4
        im = Image.new("RGBA", (s * k, s * k), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, s * k - 1, s * k - 1], radius=int(s * k * 0.2), fill=self.SIGNAL + (255,))
        cut = s * k * 0.26  # a slanted corner, like a broadcast bug
        d.polygon([(s * k - cut, s * k), (s * k, s * k - cut), (s * k, s * k)], fill=(0, 0, 0, 0))
        im = im.resize((s, s), Image.LANCZOS)
        rd = text("RD", font("anton", s * 0.62), self.WHITE)
        place(im, rd, s * 0.5, s * 0.52, "cm")
        return im

    def wordmark(self, h=200):
        f = font("anton", h)
        return row([text("RIFT", f, self.WHITE, spacing=0.02), text("DAILY", f, self.SIGNAL, spacing=0.02)],
                   gap=int(h * 0.22))

    def avatar(self, s=800):
        im = Image.new("RGBA", (s, s), self.CARBON + (255,))
        d = ImageDraw.Draw(im)
        for x in range(-s, s * 2, 26):
            d.line([(x, 0), (x + s, s)], fill=self.CARBON2, width=6)
        place(im, self.tile(int(s * 0.6)), s / 2, s / 2, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = Image.new("RGBA", (bw, bh), self.CARBON + (255,))
        d = ImageDraw.Draw(im)
        for x in range(-bw, bw * 2, 34):
            d.line([(x, 0), (x + bh, bh)], fill=self.CARBON2, width=8)
        t = self.tile(300)
        place(im, t, 560, 720, "lm")
        wm = fit(self.wordmark(220), w=1100)
        place(im, wm, 560 + 300 + 60, 690, "lb")
        d.rectangle([560 + 360, 708, 560 + 360 + 1100, 716], fill=self.SIGNAL)
        tag = text("LEAGUE'S BEST CLIPS — EVERY DAY", font("barlow_sc", 52), self.SLATE, spacing=0.12)
        place(im, tag, 560 + 360, 740, "lt")
        return im.convert("RGB")

    def overlay(self, frame: Image.Image) -> Image.Image:
        im = frame.copy()
        d = ImageDraw.Draw(im, "RGBA")
        d.rectangle([0, CAM_H - 38, W, CAM_H + 38], fill=self.CARBON + (238,))
        d.rectangle([0, CAM_H - 38, W, CAM_H - 34], fill=self.SIGNAL + (255,))
        place(im, self.tile(54), 24, CAM_H + 2, "lm")
        place(im, text("RIFT DAILY", font("anton", 34), self.WHITE, spacing=0.04), 90, CAM_H + 2, "lm")
        cr = row([text("CLIP", font("barlow_sc", 30), self.SIGNAL, spacing=0.1),
                  text(CREDIT, font("barlow_bold", 34), self.WHITE)], gap=14)
        place(im, cr, W - 26, CAM_H + 2, "rm")
        f = font("barlow_black", 82)
        parts = []
        for i, w in enumerate(CAPTION):
            t = text(w, f, self.WHITE)
            if i == ACTIVE:
                box = Image.new("RGBA", (t.width + 28, t.height + 22), (0, 0, 0, 0))
                ImageDraw.Draw(box).rounded_rectangle([0, 0, box.width - 1, box.height - 1], radius=12,
                                                      fill=self.SIGNAL + (255,))
                place(box, t, box.width / 2, box.height / 2, "cm")
                t = box
            parts.append(t)
        place(im, soft_shadow(row(parts, gap=16), 8, 0.7, 3), W / 2, CAM_H - 112, "cm")
        l1 = text(HOOK[0], font("anton", 92), self.WHITE)
        l2 = text(HOOK[1], font("anton", 92), self.SIGNAL)
        hk = stack([l1, l2], gap=10, align="l")
        panel = Image.new("RGBA", (hk.width + 70, hk.height + 50), self.CARBON + (200,))
        ImageDraw.Draw(panel).rectangle([0, 0, 11, panel.height], fill=self.SIGNAL + (255,))
        place(panel, hk, 40, 25, "lt")
        place(im, fit(panel, w=1000), 40, CAM_H + 78, "lt")
        return im


# -- C: arcade -----------------------------------------------------------------------------------------------------

class Arcade:
    key, name = "C", "Arcade"
    pitch = "Retro and playful: a pixel-R arcade coin, synthwave magenta and orange on deep purple, blocky type."
    DEEP, PURPLE, MAGENTA, ORANGE, CREAM = (22, 9, 43), (64, 22, 108), (255, 46, 136), (255, 158, 44), (255, 240, 214)
    palette = [("Neon Magenta", MAGENTA), ("Sunset Orange", ORANGE), ("Deep Purple", DEEP), ("Cream", CREAM)]
    fonts = "Bungee · Press Start 2P"
    R = ["11111.", "11..11", "11..11", "11..11", "11111.", "11.11.", "11..11", "11..11", "11...11"]

    def coin(self, s):
        k = 3
        S = s * k
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([0, 0, S - 1, S - 1], fill=self.DEEP + (255,))
        rim = fill_gradient(Image.new("RGBA", (S, S), (255, 255, 255, 0)), [(0, self.ORANGE), (1, self.MAGENTA)])
        m = Image.new("L", (S, S), 0)
        md = ImageDraw.Draw(m)
        md.ellipse([int(S * 0.03), int(S * 0.03), int(S * 0.97), int(S * 0.97)], fill=255)
        md.ellipse([int(S * 0.13), int(S * 0.13), int(S * 0.87), int(S * 0.87)], fill=0)
        rim.putalpha(m)
        im.alpha_composite(rim)
        inner = fill_gradient(Image.new("RGBA", (S, S), (0, 0, 0, 0)), [(0, self.PURPLE), (1, self.DEEP)])
        m2 = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m2).ellipse([int(S * 0.16), int(S * 0.16), int(S * 0.84), int(S * 0.84)], fill=255)
        inner.putalpha(m2)
        im.alpha_composite(inner)
        px = S * 0.052
        cols = max(len(r) for r in self.R)
        x0, y0 = S / 2 - cols * px / 2 + px * 0.3, S / 2 - len(self.R) * px / 2
        for j, line in enumerate(self.R):
            for i, c in enumerate(line):
                if c == "1":
                    d.rectangle([x0 + i * px + px * 0.5, y0 + j * px + px * 0.5, x0 + (i + 1) * px + px * 0.5,
                                 y0 + (j + 1) * px + px * 0.5], fill=self.MAGENTA + (255,))
                    d.rectangle([x0 + i * px, y0 + j * px, x0 + (i + 1) * px, y0 + (j + 1) * px],
                                fill=self.CREAM + (255,))
        im = im.resize((s, s), Image.LANCZOS)
        return glow(im, self.MAGENTA, s * 0.05, 0.6)

    def neon_text(self, t, size, shadow=True):
        f = font("bungee", size)
        im = fill_gradient(text(t, f, (255, 255, 255)), [(0, self.CREAM), (0.55, self.ORANGE), (1, self.MAGENTA)])
        im = scanlines(im, max(3, size // 18), 0.18)
        return hard_shadow(im, int(size * 0.06), int(size * 0.07), self.DEEP) if shadow else im

    def wordmark(self, h=200):
        return self.neon_text("RIFT DAILY", h)

    def sky(self, w, h, horizon):
        im = fill_gradient(Image.new("RGBA", (w, h), (0, 0, 0, 255)),
                           [(0, self.DEEP), (horizon / h * 0.7, self.PURPLE), (horizon / h, self.MAGENTA),
                            (horizon / h + 0.001, self.DEEP), (1, self.DEEP)])
        d = ImageDraw.Draw(im)
        for i in range(1, 14):
            y = horizon + (h - horizon) * (i / 13) ** 2
            d.line([(0, y), (w, y)], fill=self.MAGENTA + (255,), width=max(1, int(h * 0.003)))
        for i in range(-14, 15):
            d.line([(w / 2 + i * w * 0.012, horizon), (w / 2 + i * w * 0.16, h)], fill=self.MAGENTA + (255,),
                   width=max(1, int(h * 0.003)))
        return im

    def avatar(self, s=800):
        im = self.sky(s, s, s * 0.7)
        place(im, self.coin(int(s * 0.62)), s / 2, s * 0.45, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = self.sky(bw, bh, 900)
        sun = Image.new("RGBA", (520, 520), (0, 0, 0, 0))
        ImageDraw.Draw(sun).ellipse([0, 0, 519, 519], fill=(255, 255, 255, 255))
        sun = fill_gradient(sun, [(0, self.ORANGE), (1, self.MAGENTA)])
        sd = ImageDraw.Draw(sun)
        for i, y in enumerate(range(300, 520, 38)):
            sd.rectangle([0, y, 520, y + 6 + i * 2], fill=(0, 0, 0, 0))
        place(im, sun, bw / 2, 900, "cb")
        place(im, fit(self.wordmark(240), w=1080), bw / 2 + 110, 660, "cm")
        place(im, text("NEW CLIP EVERY DAY", font("press", 34), self.CREAM), bw / 2, 805, "cm")
        place(im, self.coin(190), bw / 2 - 540, 660, "cm")
        return im.convert("RGB")

    def overlay(self, frame: Image.Image) -> Image.Image:
        im = frame.copy()
        line = Image.new("RGBA", (W, 6), self.MAGENTA + (255,))
        place(im, glow(line, self.MAGENTA, 10, 0.8), 0, CAM_H, "lm")
        place(im, self.coin(70), 18, CAM_H, "lm")
        place(im, text("RIFT DAILY", font("press", 20), self.CREAM), 98, CAM_H, "lm")
        lab = row([text("P1", font("press", 22), self.ORANGE), text("midbeast", font("press", 22), self.CREAM)], gap=16)
        box = Image.new("RGBA", (lab.width + 40, lab.height + 30), self.DEEP + (240,))
        bd = ImageDraw.Draw(box)
        bd.rectangle([0, 0, box.width - 1, box.height - 1], outline=self.MAGENTA + (255,), width=4)
        for cx, cy in [(0, 0), (box.width - 4, 0), (0, box.height - 4), (box.width - 4, box.height - 4)]:
            bd.rectangle([cx, cy, cx + 3, cy + 3], fill=(0, 0, 0, 0))
        place(box, lab, box.width / 2, box.height / 2, "cm")
        place(im, box, W - 20, CAM_H, "rm")
        f = font("bungee", 76)
        words = [hard_shadow(text(w, f, self.ORANGE if i == ACTIVE else self.CREAM), 6, 7, self.MAGENTA)
                 for i, w in enumerate(CAPTION)]
        place(im, row(words, gap=20), W / 2, CAM_H - 112, "cm")
        hook = stack([self.neon_text(HOOK[0], 84), self.neon_text(HOOK[1], 84)], gap=4)
        place(im, fit(hook, w=1000), W / 2, CAM_H + 80, "ct")
        return im


# -- D: street -----------------------------------------------------------------------------------------------------

class Street:
    key, name = "D", "Street"
    pitch = "Raw and hand-made: a spray-painted RD tag with drips, marker type, masking tape on paper, one loud red."
    PAPER, INK, RED, TAPE = (242, 238, 228), (20, 20, 20), (230, 57, 70), (226, 211, 168)
    palette = [("Spray Red", RED), ("Ink", INK), ("Paper", PAPER), ("Tape", TAPE)]
    fonts = "Permanent Marker · Archivo Black"
    wordmark_on = PAPER

    def spray(self, t, size, color=None, seed=5):
        color = color or self.RED
        f = font("marker", size)
        g = text(t, f, color)
        pad = int(size * 0.35)
        im = Image.new("RGBA", (g.width + 2 * pad, g.height + 2 * pad + int(size * 0.5)), (0, 0, 0, 0))
        im.alpha_composite(g, (pad, pad))
        a = np.asarray(im.getchannel("A")).astype(np.float32) / 255
        rng = np.random.default_rng(seed)
        halo = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size * 0.06)),
                          np.float32) / 255
        dots = (rng.random(a.shape) < halo * 0.35).astype(np.float32)
        alpha = np.clip(np.maximum(a, dots * 0.9), 0, 1)
        d_im = Image.fromarray((alpha * 255).astype(np.uint8))
        dd = ImageDraw.Draw(d_im)
        ys, xs = np.nonzero(a > 0.5)
        if len(xs):
            for _ in range(5):
                i = rng.integers(len(xs))
                x = xs[i]
                bottom = ys[xs == x].max()
                ln = rng.uniform(0.18, 0.45) * size
                wdt = max(3, int(size * 0.035))
                dd.line([(x, bottom - 2), (x, bottom + ln)], fill=230, width=wdt)
                dd.ellipse([x - wdt * 0.9, bottom + ln - wdt * 0.9, x + wdt * 0.9, bottom + ln + wdt * 0.9], fill=230)
        out = Image.new("RGBA", im.size, color + (0,))
        out.putalpha(d_im)
        return out.crop(out.getbbox())

    def crown(self, s):
        im = Image.new("RGBA", (s, int(s * 0.62)), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        w = max(4, int(s * 0.07))
        pts = [(w, s * 0.55), (s * 0.12, s * 0.08), (s * 0.33, s * 0.33), (s * 0.5, s * 0.02), (s * 0.67, s * 0.33),
               (s * 0.88, s * 0.08), (s - w, s * 0.55)]
        d.line(pts + [pts[0]], fill=self.INK + (255,), width=w, joint="curve")
        for x, y in pts[1:-1:2]:
            d.ellipse([x - w, y - w, x + w, y + w], fill=self.INK + (255,))
        return im

    def wordmark(self, h=200):
        wm = text("RIFT DAILY", font("marker", h), self.INK)
        sw = Image.new("RGBA", (wm.width + 40, int(h * 0.42)), (0, 0, 0, 0))
        ImageDraw.Draw(sw).line([(10, sw.height * 0.75), (sw.width * 0.5, sw.height * 0.35), (sw.width - 10, sw.height * 0.55)],
                                fill=self.RED + (255,), width=int(h * 0.13), joint="curve")
        return rotate(stack([wm, sw], gap=-int(h * 0.22)), 3)

    def tape(self, t, size, fg=None, tilt=-3.0, f="marker"):
        tx = text(t, font(f, size), fg or self.INK)
        pw, ph = tx.width + int(size * 1.2), tx.height + int(size * 0.8)
        im = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        rng = random.Random(11)
        left = [(rng.uniform(0, size * 0.25), y) for y in np.linspace(0, ph, 9)]
        right = [(pw - 1 - rng.uniform(0, size * 0.25), y) for y in np.linspace(ph, 0, 9)]
        d.polygon(left + right, fill=self.TAPE + (238,))
        im.alpha_composite(tx, ((pw - tx.width) // 2, (ph - tx.height) // 2))
        return rotate(soft_shadow(im, 5, 0.35, 3), tilt)

    def avatar(self, s=800):
        im = paper(s, s, self.PAPER).convert("RGBA")
        rd = fit(self.spray("RD", 400), w=int(s * 0.66))
        place(im, rd, s / 2, s * 0.56, "cm")
        place(im, rotate(self.crown(int(s * 0.3)), 8), s * 0.62, s * 0.17, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = paper(bw, bh, self.PAPER, seed=9).convert("RGBA")
        swoosh = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ImageDraw.Draw(swoosh).line([(560, 820), (1200, 600), (2000, 700)], fill=self.RED + (210,), width=150,
                                    joint="curve")
        im.alpha_composite(swoosh.filter(ImageFilter.GaussianBlur(3)))
        place(im, fit(text("RIFT DAILY", font("marker", 260), self.INK), w=1250), 1280, 690, "cm")
        place(im, self.tape("LEAGUE'S BEST CLIPS. EVERY DAY.", 52, tilt=-2), 1280, 860, "cm")
        place(im, rotate(self.crown(170), -10), 610, 520, "cm")
        return im.convert("RGB")

    def overlay(self, frame: Image.Image) -> Image.Image:
        im = frame.copy()
        line = Image.new("RGBA", (W + 40, 30), (0, 0, 0, 0))
        pts = [(x, 15 + 4 * math.sin(x / 37)) for x in range(0, W + 40, 6)]
        ImageDraw.Draw(line).line(pts, fill=self.INK + (255,), width=9, joint="curve")
        place(im, line, -20, CAM_H, "lm")
        place(im, fit(self.spray("RD", 140, seed=2), h=92), 18, CAM_H + 6, "lm")
        place(im, fit(self.tape("clip: midbeast", 40, tilt=-3), h=92), W - 14, CAM_H, "rm")
        f = font("archivo", 80)
        parts = []
        for i, w in enumerate(CAPTION):
            parts.append(text(w, f, self.RED if i == ACTIVE else (255, 255, 255), stroke=9, stroke_fill=self.INK))
        place(im, row(parts, gap=16), W / 2, CAM_H - 112, "cm")
        l1 = self.tape(HOOK[0], 70, tilt=-2)
        l2 = self.tape(HOOK[1], 70, fg=self.RED, tilt=1.5)
        place(im, fit(stack([l1, l2], gap=-14), w=980), W / 2, CAM_H + 70, "ct")
        return im


# -- round 2 (2026-11-03: "i like B the most, but want more options, maybe 2-3 like B + 2-3 more") -----------------

GFONTS = ROOT / "build/fonts/google"


def gfont(family: str, weight: int, size: float, italic: bool = False) -> ImageFont.FreeTypeFont:
    """Any Google font at one weight, fetched once through the Google Fonts CSS API."""
    path = GFONTS / f"{family.replace(' ', '')}-{weight}{'i' if italic else ''}.ttf"
    if not path.exists():
        import re
        GFONTS.mkdir(parents=True, exist_ok=True)
        spec = f"{family.replace(' ', '+')}:ital,wght@{1 if italic else 0},{weight}"
        req = urllib.request.Request(f"https://fonts.googleapis.com/css2?family={spec}", headers={"User-Agent": "Mozilla/4.0"})
        css = urllib.request.urlopen(req, timeout=30).read().decode()
        urllib.request.urlretrieve(re.search(r"url\((https://[^)]+\.ttf)\)", css).group(1), path)
    return ImageFont.truetype(str(path), max(6, int(round(size))))


def shear(im: Image.Image, k: float) -> Image.Image:
    """Lean a shape forward by k (0.2 = 0.2 px across per px down), like italics."""
    pad = int(abs(k) * im.height) + 2
    return im.transform((im.width + pad, im.height), Image.AFFINE, (1, k, -pad if k > 0 else 0, 0, 1, 0),
                        resample=Image.BICUBIC)


def slanted(w: int, h: int, color, slant: float = 0.22, k: int = 3) -> Image.Image:
    im = Image.new("RGBA", (w * k, h * k), (0, 0, 0, 0))
    s = h * k * slant
    ImageDraw.Draw(im).polygon([(s, 0), (w * k, 0), (w * k - s, h * k), (0, h * k)], fill=color)
    return im.resize((w, h), Image.LANCZOS)


def lines_bg(w: int, h: int, color, line, step: int, width: int) -> Image.Image:
    im = Image.new("RGBA", (w, h), color + (255,))
    d = ImageDraw.Draw(im)
    for x in range(-h, w + h, step):
        d.line([(x, 0), (x + h, h)], fill=line, width=width)
    return im


class NightGame:
    key, name = "B2", "Night Game"
    pitch = "B with speed: an electric-blue slanted RD badge on true black, very condensed type, slanted tabs."
    BLACK, PANEL, BLUE, ICE, STEEL = (8, 8, 10), (22, 24, 30), (37, 99, 255), (238, 243, 255), (126, 134, 152)
    palette = [("Electric", BLUE), ("Black", BLACK), ("Ice", ICE), ("Steel", STEEL)]
    fonts = "Big Shoulders Display · Barlow"

    def badge(self, h):
        w = int(h * 1.32)
        im = slanted(w, h, self.BLUE + (255,), 0.24)
        place(im, text("RD", gfont("Big Shoulders Display", 900, h * 0.92), self.ICE), w / 2 + h * 0.02, h * 0.53, "cm")
        return im

    def wordmark(self, h=220):
        f = gfont("Big Shoulders Display", 900, h)
        return shear(row([text("RIFT", f, self.ICE, spacing=0.02), text("DAILY", f, self.BLUE, spacing=0.02)],
                         gap=int(h * 0.16)), -0.12)

    def avatar(self, s=800):
        im = lines_bg(s, s, self.BLACK, self.PANEL + (255,), 30, 8)
        place(im, self.badge(int(s * 0.44)), s / 2, s / 2, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = lines_bg(bw, bh, self.BLACK, self.PANEL + (255,), 40, 10)
        b = self.badge(250)
        place(im, b, 560, 720, "lm")
        wm = fit(self.wordmark(230), w=1060)
        place(im, wm, 560 + b.width + 50, 700, "lb")
        tag = text("LEAGUE'S BEST CLIPS · EVERY DAY", gfont("Barlow Semi Condensed", 600, 50), self.STEEL, spacing=0.12)
        place(im, tag, 560 + b.width + 70, 735, "lt")
        return im.convert("RGB")

    def overlay(self, frame):
        im = frame.copy()
        d = ImageDraw.Draw(im, "RGBA")
        d.rectangle([0, CAM_H - 36, W, CAM_H + 36], fill=self.BLACK + (236,))
        left = slanted(330, 72, self.BLUE + (255,), 0.32)
        place(left, self.badge(46), 40, 36, "lm")
        place(left, text("RIFT DAILY", gfont("Big Shoulders Display", 900, 40), self.ICE, spacing=0.03), 120, 36, "lm")
        place(im, left, -20, CAM_H, "lm")
        tab = slanted(116, 72, self.BLUE + (255,), 0.32)
        place(tab, text("CLIP", gfont("Barlow Semi Condensed", 700, 30), self.ICE, spacing=0.08), 58, 36, "cm")
        handle = text(CREDIT, gfont("Barlow", 700, 34), self.ICE)
        place(im, handle, W - 26, CAM_H, "rm")
        place(im, tab, W - 26 - handle.width - 14, CAM_H, "rm")
        f = gfont("Barlow", 900, 82)
        parts = []
        for i, w in enumerate(CAPTION):
            t = text(w, f, self.ICE)
            if i == ACTIVE:
                box = slanted(t.width + 50, t.height + 26, self.BLUE + (255,), 0.2)
                place(box, t, box.width / 2, box.height / 2, "cm")
                t = box
            parts.append(t)
        place(im, soft_shadow(row(parts, gap=14), 8, 0.7, 3), W / 2, CAM_H - 112, "cm")
        f2 = gfont("Big Shoulders Display", 900, 112)
        hk = stack([text(HOOK[0], f2, self.ICE), text(HOOK[1], f2, self.BLUE)], gap=4, align="l")
        panel = slanted(hk.width + 120, hk.height + 50, self.BLACK + (205,), 0.12)
        place(panel, hk, 60, 25, "lt")
        place(im, fit(panel, w=1020), 20, CAM_H + 80, "lt")
        return im


class Championship:
    key, name = "B3", "Championship"
    pitch = "B made premium: a gold shield with a varsity RD, black and trophy gold, condensed type, gold rules."
    BLACK, GRAPHITE, GOLD, WHITE, GREY = (11, 11, 11), (34, 33, 30), (232, 184, 52), (246, 243, 235), (150, 146, 136)
    palette = [("Trophy Gold", GOLD), ("Black", BLACK), ("Ivory", WHITE), ("Graphite", GRAPHITE)]
    fonts = "Graduate · Saira Condensed"

    def shield(self, h):
        w, k = int(h * 0.84), 3
        S = Image.new("RGBA", (w * k, h * k), (0, 0, 0, 0))
        pts = lambda m: [(w * k * (0.04 + m), h * k * (0.07 + m)), (w * k * 0.5, h * k * (0.0 + m * 1.1)),  # noqa: E731
                         (w * k * (0.96 - m), h * k * (0.07 + m)), (w * k * (0.96 - m), h * k * (0.56 - m * 0.2)),
                         (w * k * 0.5, h * k * (1.0 - m * 1.4)), (w * k * (0.04 + m), h * k * (0.56 - m * 0.2))]
        d = ImageDraw.Draw(S)
        d.polygon(pts(0), fill=self.GOLD + (255,))
        d.line(pts(0.06) + [pts(0.06)[0]], fill=self.BLACK + (255,), width=int(h * k * 0.022), joint="curve")
        S = S.resize((w, h), Image.LANCZOS)
        place(S, text("RD", gfont("Graduate", 400, h * 0.36), self.BLACK), w / 2, h * 0.44, "cm")
        return S

    def wordmark(self, h=210):
        wm = text("RIFT DAILY", gfont("Saira Condensed", 900, h), self.WHITE, spacing=0.03)
        im = Image.new("RGBA", (wm.width, wm.height + int(h * 0.36)), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        im.alpha_composite(wm, (0, int(h * 0.18)))
        lw = max(3, int(h * 0.025))
        d.rectangle([0, 0, wm.width, lw], fill=self.GOLD + (255,))
        d.rectangle([0, im.height - lw - 1, wm.width, im.height - 1], fill=self.GOLD + (255,))
        return im

    def glow_bg(self, w, h, cx, cy, r):
        y, x = np.mgrid[0:h, 0:w].astype(np.float32)
        k = np.clip(1 - np.hypot(x - cx, y - cy) / r, 0, 1) ** 1.6
        base, hi = np.array(self.BLACK, np.float32), np.array(self.GRAPHITE, np.float32) * 1.4
        arr = base + (hi - base) * k[..., None]
        return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    def avatar(self, s=800):
        im = self.glow_bg(s, s, s / 2, s / 2, s * 0.6)
        place(im, self.shield(int(s * 0.66)), s / 2, s / 2, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = self.glow_bg(bw, bh, bw / 2, bh / 2, 1100)
        sh = self.shield(330)
        place(im, sh, 600, 720, "lm")
        wm = fit(self.wordmark(220), w=1080)
        place(im, wm, 600 + sh.width + 70, 690, "lm")
        tag = text("LEAGUE'S BEST CLIPS · EVERY DAY", gfont("Saira Condensed", 600, 50), self.GOLD, spacing=0.16)
        place(im, tag, 600 + sh.width + 70, 690 + wm.height / 2 + 30, "lt")
        return im.convert("RGB")

    def overlay(self, frame):
        im = frame.copy()
        d = ImageDraw.Draw(im, "RGBA")
        d.rectangle([0, CAM_H - 38, W, CAM_H + 38], fill=self.BLACK + (238,))
        d.rectangle([0, CAM_H - 38, W, CAM_H - 36], fill=self.GOLD + (255,))
        d.rectangle([0, CAM_H + 36, W, CAM_H + 38], fill=self.GOLD + (255,))
        place(im, self.shield(56), 26, CAM_H, "lm")
        place(im, text("RIFT DAILY", gfont("Saira Condensed", 800, 40), self.WHITE, spacing=0.05), 84, CAM_H, "lm")
        cr = row([text("CLIP", gfont("Saira Condensed", 600, 30), self.GOLD, spacing=0.14),
                  text(CREDIT, gfont("Saira Condensed", 700, 38), self.WHITE, spacing=0.02)], gap=16)
        place(im, cr, W - 26, CAM_H, "rm")
        f = gfont("Saira Condensed", 900, 96)
        words = [text(w, f, self.GOLD if i == ACTIVE else self.WHITE) for i, w in enumerate(CAPTION)]
        place(im, soft_shadow(row(words, gap=20), 9, 0.8, 3), W / 2, CAM_H - 112, "cm")
        f2 = gfont("Saira Condensed", 900, 110)
        l1, l2 = text(HOOK[0], f2, self.WHITE), text(HOOK[1], f2, self.GOLD)
        hk = stack([l1, l2], gap=8)
        panel = Image.new("RGBA", (hk.width + 80, hk.height + 60), (0, 0, 0, 0))
        pd = ImageDraw.Draw(panel)
        pd.rectangle([0, 0, panel.width, panel.height], fill=self.BLACK + (190,))
        pd.rectangle([0, 0, panel.width, 3], fill=self.GOLD + (255,))
        pd.rectangle([0, panel.height - 4, panel.width, panel.height], fill=self.GOLD + (255,))
        place(panel, hk, panel.width / 2, panel.height / 2, "cm")
        place(im, fit(panel, w=1000), W / 2, CAM_H + 82, "ct")
        return im


class Daylight:
    key, name = "B4", "Daylight"
    pitch = "B in daylight: a red roundel on chalk white, black condensed type, a white lower third, boxed captions."
    CHALK, RED, BLACK, GREY = (246, 244, 239), (226, 35, 26), (16, 16, 16), (122, 120, 116)
    palette = [("Race Red", RED), ("Chalk", CHALK), ("Black", BLACK), ("Grey", GREY)]
    fonts = "Oswald · Barlow"
    wordmark_on = CHALK

    def roundel(self, s):
        k = 4
        im = Image.new("RGBA", (s * k, s * k), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([0, 0, s * k - 1, s * k - 1], fill=self.RED + (255,))
        m = s * k * 0.07
        d.ellipse([m, m, s * k - 1 - m, s * k - 1 - m], outline=self.CHALK + (255,), width=int(s * k * 0.022))
        im = im.resize((s, s), Image.LANCZOS)
        place(im, text("RD", gfont("Oswald", 700, s * 0.46), self.CHALK), s / 2, s * 0.5, "cm")
        return im

    def wordmark(self, h=210):
        f = gfont("Oswald", 700, h)
        return row([text("RIFT", f, self.BLACK, spacing=0.01), text("DAILY", f, self.RED, spacing=0.01)],
                   gap=int(h * 0.2))

    def paper_grid(self, w, h, step):
        im = Image.new("RGBA", (w, h), self.CHALK + (255,))
        d = ImageDraw.Draw(im)
        for x in range(0, w, step):
            d.line([(x, 0), (x, h)], fill=(232, 229, 222, 255), width=2)
        for y in range(0, h, step):
            d.line([(0, y), (w, y)], fill=(232, 229, 222, 255), width=2)
        return im

    def avatar(self, s=800):
        im = self.paper_grid(s, s, 40)
        place(im, self.roundel(int(s * 0.66)), s / 2, s / 2, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = self.paper_grid(bw, bh, 64)
        r = self.roundel(300)
        place(im, r, 580, 720, "lm")
        wm = fit(self.wordmark(220), w=1050)
        place(im, wm, 580 + 300 + 60, 700, "lb")
        tag = text("LEAGUE'S BEST CLIPS — EVERY DAY", gfont("Barlow Semi Condensed", 600, 50), self.GREY, spacing=0.12)
        place(im, tag, 580 + 300 + 64, 735, "lt")
        return im.convert("RGB")

    def boxed(self, t, f, fg, bg, padx=18, pady=10):
        tx = text(t, f, fg)
        box = Image.new("RGBA", (tx.width + 2 * padx, tx.height + 2 * pady), bg + (255,))
        place(box, tx, box.width / 2, box.height / 2, "cm")
        return box

    def overlay(self, frame):
        im = frame.copy()
        d = ImageDraw.Draw(im, "RGBA")
        d.rectangle([0, CAM_H - 36, W, CAM_H + 36], fill=self.CHALK + (246,))
        d.rectangle([0, CAM_H - 36, W, CAM_H - 32], fill=self.RED + (255,))
        place(im, self.roundel(54), 24, CAM_H + 2, "lm")
        place(im, text("RIFT DAILY", gfont("Oswald", 700, 36), self.BLACK, spacing=0.03), 92, CAM_H + 2, "lm")
        cr = row([text("CLIP", gfont("Barlow Semi Condensed", 700, 30), self.RED, spacing=0.1),
                  text(CREDIT, gfont("Barlow", 700, 34), self.BLACK)], gap=14)
        place(im, cr, W - 26, CAM_H + 2, "rm")
        f = gfont("Barlow", 900, 76)
        words = [self.boxed(w, f, self.CHALK if i == ACTIVE else self.BLACK, self.RED if i == ACTIVE else self.CHALK)
                 for i, w in enumerate(CAPTION)]
        place(im, soft_shadow(row(words, gap=10), 6, 0.5, 3), W / 2, CAM_H - 112, "cm")
        f2 = gfont("Oswald", 700, 92)
        hk = stack([self.boxed(HOOK[0], f2, self.BLACK, self.CHALK, 26, 8), self.boxed(HOOK[1], f2, self.RED, self.CHALK, 26, 8)],
                   gap=10, align="l")
        place(im, soft_shadow(fit(hk, w=1000), 8, 0.5, 4), 26, CAM_H + 70, "lt")
        return im


class Chrome:
    key, name = "E", "Chrome"
    pitch = "Y2K and flashy: liquid-chrome lettering with sparkles on black, wide rounded type, ice-blue light."
    BLACK, ICE, SILVER, NIGHT, WHITE = (6, 6, 8), (150, 215, 255), (200, 205, 215), (18, 20, 28), (248, 250, 255)
    palette = [("Chrome", SILVER), ("Ice", ICE), ("Black", BLACK), ("White", WHITE)]
    fonts = "Unbounded"
    BANDS = [(0, (255, 255, 255)), (0.36, (196, 204, 220)), (0.5, (62, 66, 80)), (0.56, (120, 126, 140)),
             (0.68, (226, 234, 246)), (0.86, (150, 160, 178)), (1, (236, 242, 252))]

    def chrome(self, t, size, weight=800):
        g = text(t, gfont("Unbounded", weight, size), (255, 255, 255))
        im = fill_gradient(g, self.BANDS)
        out = grow(im, size * 0.045, (24, 26, 34))
        return glow(out, self.ICE, size * 0.08, 0.35)

    def sparkle(self, s, color=None):
        color = color or self.WHITE
        im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c, a, b = s / 2, s / 2, s * 0.09
        d.polygon([(c, c - a), (c + b, c - b), (c + a, c), (c + b, c + b), (c, c + a), (c - b, c + b), (c - a, c),
                   (c - b, c - b)], fill=color + (255,))
        return glow(im, self.ICE, s * 0.12, 0.8)

    def wordmark(self, h=200):
        return self.chrome("RIFT DAILY", h)

    def spotlight(self, w, h, cx, cy, r):
        y, x = np.mgrid[0:h, 0:w].astype(np.float32)
        k = np.clip(1 - np.hypot((x - cx) / 1.4, y - cy) / r, 0, 1) ** 2
        arr = np.array(self.BLACK, np.float32) + (np.array((30, 44, 70), np.float32) - self.BLACK) * k[..., None]
        return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")

    def avatar(self, s=800):
        im = self.spotlight(s, s, s / 2, s / 2, s * 0.55)
        rd = fit(self.chrome("RD", 300, 900), w=int(s * 0.62))
        place(im, rd, s / 2, s / 2, "cm")
        place(im, self.sparkle(int(s * 0.16)), s * 0.76, s * 0.27, "cm")
        place(im, self.sparkle(int(s * 0.09)), s * 0.25, s * 0.72, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = self.spotlight(bw, bh, bw / 2, bh / 2, 900)
        wm = fit(self.wordmark(200), w=1300)
        place(im, wm, bw / 2, 690, "cm")
        place(im, self.sparkle(130), bw / 2 + wm.width / 2 - 30, 690 - wm.height / 2 + 10, "cm")
        place(im, self.sparkle(70), bw / 2 - wm.width / 2 + 40, 690 + wm.height / 2 - 20, "cm")
        tag = text("LEAGUE'S BEST CLIPS · EVERY DAY", gfont("Unbounded", 500, 38), self.SILVER, spacing=0.14)
        place(im, tag, bw / 2, 690 + wm.height / 2 + 50, "ct")
        return im.convert("RGB")

    def overlay(self, frame):
        im = frame.copy()
        line = fill_gradient(Image.new("RGBA", (W, 5), (255, 255, 255, 255)), [(0, self.SILVER), (1, self.SILVER)])
        hl = np.linspace(0, 1, W)
        arr = np.asarray(line).copy()
        arr[..., :3] = (np.array(self.SILVER)[None, None, :] * (0.55 + 0.45 * np.sin(hl * 9)[None, :, None] ** 2)).astype(np.uint8)
        place(im, Image.fromarray(arr, "RGBA"), 0, CAM_H, "lm")

        def pill(content):
            p = Image.new("RGBA", (content.width + 48, max(66, content.height + 28)), (0, 0, 0, 0))
            ImageDraw.Draw(p).rounded_rectangle([0, 0, p.width - 1, p.height - 1], radius=p.height // 2,
                                                fill=self.NIGHT + (235,), outline=self.SILVER + (255,), width=3)
            place(p, content, p.width / 2, p.height / 2, "cm")
            return p

        tag = row([fit(self.chrome("RD", 60, 900), h=40), text("RIFT DAILY", gfont("Unbounded", 700, 24), self.WHITE)],
                  gap=12)
        place(im, pill(tag), 22, CAM_H, "lm")
        lab = row([text("CLIP", gfont("Unbounded", 600, 24), self.ICE, spacing=0.1),
                   text(CREDIT, gfont("Unbounded", 600, 26), self.WHITE)], gap=14)
        place(im, pill(lab), W - 22, CAM_H, "rm")
        f = gfont("Unbounded", 800, 66)
        words = [glow(text(w, f, self.ICE if i == ACTIVE else self.WHITE), self.ICE, 10, 0.45)
                 for i, w in enumerate(CAPTION)]
        place(im, row(words, gap=4), W / 2, CAM_H - 112, "cm")
        hk = stack([self.chrome(HOOK[0], 80), self.chrome(HOOK[1], 80)], gap=-10)
        place(im, fit(hk, w=1020), W / 2, CAM_H + 70, "ct")
        return im


class Mono:
    key, name = "F", "Mono"
    pitch = "Swiss and calm: lowercase 'rift daily.' in a characterful grotesk, black and white only, sharp labels."
    BLACK, WHITE, GREY = (12, 12, 12), (250, 250, 248), (150, 150, 150)
    palette = [("Black", BLACK), ("White", WHITE), ("Grey", GREY)]
    fonts = "Bricolage Grotesque"
    wordmark_on = WHITE

    def f(self, size, weight=800):
        return gfont("Bricolage Grotesque", weight, size)

    def wordmark(self, h=200):
        return text("rift daily.", self.f(h), self.BLACK)

    def avatar(self, s=800):
        im = Image.new("RGBA", (s, s), self.BLACK + (255,))
        place(im, text("rd.", self.f(s * 0.42), self.WHITE), s * 0.52, s * 0.47, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = Image.new("RGBA", (bw, bh), self.WHITE + (255,))
        wm = fit(text("rift daily.", self.f(300), self.BLACK), w=1400)
        place(im, wm, 580, 700, "lb")
        place(im, text("league's best clips. every day.", self.f(56, 500), self.GREY), 586, 740, "lt")
        return im.convert("RGB")

    def label(self, t, size=34, fg=None, bg=None):
        tx = text(t, self.f(size, 700), fg or self.BLACK)
        box = Image.new("RGBA", (tx.width + 36, tx.height + 22), (bg or self.WHITE) + (255,))
        place(box, tx, 18, box.height / 2, "lm")
        return box

    def overlay(self, frame):
        im = frame.copy()
        place(im, self.label("rift daily.", 34), 24, CAM_H, "lm")
        place(im, self.label("clip — midbeast", 30), W - 24, CAM_H, "rm")
        f = self.f(84)
        words, xs = [], []
        for i, w in enumerate(CAPTION):
            t = text(w.lower(), f, self.WHITE)
            if i == ACTIVE:
                u = Image.new("RGBA", (t.width, t.height + 22), (0, 0, 0, 0))
                u.alpha_composite(t, (0, 0))
                ImageDraw.Draw(u).rectangle([0, u.height - 10, u.width, u.height], fill=self.WHITE + (255,))
                t = u
            words.append(t)
        place(im, soft_shadow(row(words, gap=22), 10, 0.75, 3), W / 2, CAM_H - 112, "cm")
        hk = stack([self.label(HOOK[0].lower(), 70), self.label(HOOK[1].lower(), 70)], gap=0, align="l")
        place(im, fit(hk, w=1000), 24, CAM_H + 70, "lt")
        return im


class Esports:
    key, name = "G", "Esports"
    pitch = "Built like a team jersey: an angular crest with chevrons, crimson and black, heavy italic type."
    BLACK, CRIMSON, WHITE, STEEL, DARK = (10, 10, 12), (226, 24, 56), (245, 245, 247), (100, 104, 114), (30, 30, 36)
    palette = [("Crimson", CRIMSON), ("Black", BLACK), ("White", WHITE), ("Steel", STEEL)]
    fonts = "Kanit Black Italic · Teko"

    def crest(self, h):
        w, k = int(h * 0.9), 3
        S = Image.new("RGBA", (w * k, h * k), (0, 0, 0, 0))
        d = ImageDraw.Draw(S)
        P = lambda pts: [(x * w * k, y * h * k) for x, y in pts]  # noqa: E731
        d.polygon(P([(0.12, 0), (0.88, 0), (1, 0.16), (1, 0.62), (0.5, 1), (0, 0.62), (0, 0.16)]),
                  fill=self.CRIMSON + (255,))
        d.polygon(P([(0.18, 0.08), (0.82, 0.08), (0.91, 0.2), (0.91, 0.58), (0.5, 0.89), (0.09, 0.58), (0.09, 0.2)]),
                  fill=self.BLACK + (255,))
        for i in range(2):
            y = 0.66 + i * 0.1
            d.polygon(P([(0.26, y), (0.5, y + 0.12), (0.74, y), (0.74, y + 0.05), (0.5, y + 0.17), (0.26, y + 0.05)]),
                      fill=self.CRIMSON + (255,))
        S = S.resize((w, h), Image.LANCZOS)
        place(S, text("RD", gfont("Kanit", 900, h * 0.38, italic=True), self.WHITE), w / 2, h * 0.37, "cm")
        return S

    def wordmark(self, h=200):
        f = gfont("Kanit", 900, h, italic=True)
        return row([text("RIFT", f, self.WHITE), text("DAILY", f, self.CRIMSON)], gap=int(h * 0.12))

    def slashes(self, w, h, n, alpha=255):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for i in range(n):
            x = w * (0.55 + i * 0.12)
            d.polygon([(x, 0), (x + w * 0.06, 0), (x - h * 0.6 + w * 0.06, h), (x - h * 0.6, h)],
                      fill=self.CRIMSON + (alpha if i == 0 else alpha // (i + 1),))
        return im

    def avatar(self, s=800):
        im = Image.new("RGBA", (s, s), self.BLACK + (255,))
        im.alpha_composite(self.slashes(s, s, 3, 150))
        place(im, self.crest(int(s * 0.7)), s / 2, s / 2, "cm")
        return im.convert("RGB")

    def banner(self):
        bw, bh = 2560, 1440
        im = Image.new("RGBA", (bw, bh), self.BLACK + (255,))
        im.alpha_composite(self.slashes(bw, bh, 4, 170))
        c = self.crest(340)
        place(im, c, 580, 720, "lm")
        wm = fit(self.wordmark(220), w=1100)
        place(im, wm, 580 + c.width + 50, 700, "lb")
        tag = text("LEAGUE'S BEST CLIPS  //  EVERY DAY", gfont("Teko", 600, 64), self.STEEL, spacing=0.08)
        place(im, tag, 580 + c.width + 64, 742, "lt")
        return im.convert("RGB")

    def overlay(self, frame):
        im = frame.copy()
        band = slanted(W + 120, 74, self.BLACK + (238,), 0.4)
        d = ImageDraw.Draw(band)
        for i in range(3):
            x = 360 + i * 22
            d.polygon([(x, 0), (x + 12, 0), (x - 18, 74), (x - 30, 74)], fill=self.CRIMSON + (255 - i * 60,))
        place(im, band, -60, CAM_H, "lm")
        place(im, self.crest(64), 26, CAM_H, "lm")
        place(im, text("RIFT DAILY", gfont("Kanit", 900, 38, italic=True), self.WHITE), 96, CAM_H, "lm")
        cr = row([text("CLIP", gfont("Kanit", 800, 30, italic=True), self.CRIMSON),
                  text(CREDIT, gfont("Kanit", 700, 32, italic=True), self.WHITE)], gap=12)
        place(im, cr, W - 30, CAM_H, "rm")
        f = gfont("Kanit", 900, 86, italic=True)
        words = [text(w, f, self.CRIMSON if i == ACTIVE else self.WHITE, stroke=8, stroke_fill=self.BLACK)
                 for i, w in enumerate(CAPTION)]
        place(im, row(words, gap=16), W / 2, CAM_H - 112, "cm")
        f2 = gfont("Kanit", 900, 96, italic=True)
        hk = stack([text(HOOK[0], f2, self.WHITE, stroke=8, stroke_fill=self.BLACK),
                    text(HOOK[1], f2, self.CRIMSON, stroke=8, stroke_fill=self.BLACK)], gap=-14)
        place(im, fit(hk, w=1000), W / 2, CAM_H + 76, "ct")
        return im


OPTIONS = [Sticker(), Broadcast(), Arcade(), Street()]
ROUND2 = [NightGame(), Championship(), Daylight(), Chrome(), Mono(), Esports()]


# -- boards --------------------------------------------------------------------------------------------------------

def phone(frame: Image.Image, h: int) -> Image.Image:
    shot = fit(frame, h=h - 24)
    im = Image.new("RGBA", (shot.width + 24, shot.height + 24), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=44, fill=(5, 5, 6, 255))
    m = Image.new("L", shot.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], radius=34, fill=255)
    shot.putalpha(m)
    im.alpha_composite(shot, (12, 12))
    return im


def board(o, frame: Image.Image) -> Image.Image:
    bw, bh = 3000, 1700
    bg = (22, 22, 24)
    im = Image.new("RGBA", (bw, bh), bg + (255,))
    shot = o.overlay(frame)
    shot.convert("RGB").save(OUT / f"{o.key}-{o.name.lower()}-short.png")
    place(im, phone(shot, 1580), 60, 60, "lt")
    x0 = 1000
    label = font("barlow_black", 96)
    place(im, text(f"{o.key}  {o.name.upper()}", label, (245, 245, 245)), x0, 70, "lt")
    place(im, text(o.pitch, font("barlow_bold", 36), (180, 182, 190)), x0, 196, "lt")
    place(im, text("Type: " + o.fonts, font("barlow_bold", 32), (140, 142, 150)), x0, 250, "lt")
    sx = x0
    for name, col in o.palette:
        sw = Image.new("RGBA", (200, 70), col + (255,))
        ImageDraw.Draw(sw).rectangle([0, 0, 199, 69], outline=(60, 60, 66, 255), width=2)
        place(im, sw, sx, 310, "lt")
        place(im, text(name, font("barlow_bold", 26), (200, 200, 206)), sx, 390, "lt")
        sx += 230
    av = o.avatar(800)
    av.save(OUT / f"{o.key}-{o.name.lower()}-avatar.png")
    place(im, circle(av.resize((400, 400), Image.LANCZOS)), x0, 450, "lt")
    place(im, circle(av.resize((120, 120), Image.LANCZOS)), x0 + 430, 450 + 140, "lt")
    place(im, circle(av.resize((56, 56), Image.LANCZOS)), x0 + 430 + 140, 450 + 172, "lt")
    wm = fit(o.wordmark(), w=1060, h=280)
    if getattr(o, "wordmark_on", None):
        card = Image.new("RGBA", (wm.width + 80, wm.height + 60), (0, 0, 0, 0))
        ImageDraw.Draw(card).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius=24,
                                               fill=o.wordmark_on + (255,))
        place(card, wm, card.width / 2, card.height / 2, "cm")
        wm = card
    place(im, wm, x0 + 760, 650, "lm")
    bn = o.banner()
    bn.save(OUT / f"{o.key}-{o.name.lower()}-banner.png")
    place(im, fit(bn.convert("RGBA"), w=1900, h=bh - 880 - 50), x0, 880, "lt")
    return im.convert("RGB")


def overview(frame: Image.Image, options=None) -> Image.Image:
    options = options or OPTIONS
    col_w, bh = 620, 1500
    im = Image.new("RGBA", (col_w * len(options) + 100, bh), (22, 22, 24, 255))
    for i, o in enumerate(options):
        x = 50 + i * col_w
        place(im, text(f"{o.key}  {o.name.upper()}", font("barlow_black", 64), (245, 245, 245)), x + col_w / 2 - 25,
              40, "ct")
        av = circle(o.avatar(800).resize((240, 240), Image.LANCZOS))
        place(im, av, x + col_w / 2 - 25, 140, "ct")
        place(im, phone(o.overlay(frame), 1060), x + col_w / 2 - 25, 410, "ct")
    return im.convert("RGB")


def main(rounds=("1", "2")):
    OUT.mkdir(parents=True, exist_ok=True)
    frame = base_frame()
    if "1" in rounds:
        for o in OPTIONS:
            board(o, frame).save(OUT / f"board-{o.key}-{o.name.lower()}.jpg", quality=90)
            print("board", o.key, o.name)
        overview(frame).save(OUT / "overview.jpg", quality=90)
    if "2" in rounds:
        for o in ROUND2:
            slug = o.name.lower().replace(" ", "-")
            board(o, frame).save(OUT / f"board-{o.key}-{slug}.jpg", quality=90)
            print("board", o.key, o.name)
        overview(frame, [OPTIONS[1]] + ROUND2[:3]).save(OUT / "overview-like-b.jpg", quality=90)
        overview(frame, ROUND2[3:]).save(OUT / "overview-new.jpg", quality=90)
    print("overviews")


if __name__ == "__main__":
    main(tuple(sys.argv[1:]) or ("1", "2"))
