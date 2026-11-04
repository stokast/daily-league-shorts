"""Blip's brand assets, drawn from code so they can be redrawn at any size.

    python3 brand/make_brand.py            # writes brand/out/*.png

The logo: "blip" in lowercase Urbanist Black, its i dotted with a cyan ping, two rings spreading from it the way a
ping lands on the minimap. The mark is that ping alone. Colours and fonts: brand/BRAND.md.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
FONTS = HERE / "fonts"
PREFIX = "blip"

NAVY = (10, 15, 30)          # Night: every background
NAVY_2 = (19, 32, 58)        # its lighter centre
CYAN = (24, 230, 255)        # Ping: the i's dot, the primary
GOLD = (245, 197, 66)        # Gold: the accent (CLIP on the credit, the spoken word in captions)
WHITE = (244, 247, 255)
MIST = (160, 178, 210)       # secondary text on navy

LOGO_FONT = "Urbanist-Black.ttf"
RINGS = ((2.0, 0.60), (2.9, 0.28))  # the ping's rings: radius in dot radii, opacity
RING_W = 0.24                       # a ring's width, in dot radii


def font(name: str, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), max(4, int(round(size))))


def shadowed(im: Image.Image, r: float, k: float = 0.7, dy: int = 0) -> Image.Image:
    """`im` over a soft dark shadow of itself, with room round it for the shadow."""
    pad = int(r * 3) + abs(dy)
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    a = Image.new("L", out.size, 0)
    a.paste(im.getchannel("A"), (pad, pad + dy))
    sh.putalpha(a.filter(ImageFilter.GaussianBlur(r)).point(lambda v: int(v * k)))
    out.alpha_composite(sh)
    out.alpha_composite(im, (pad, pad))
    return out


def reduce(im: Image.Image, ss: int) -> Image.Image:
    """Bring a drawing made `ss` times too big down to size (how the rings get smooth edges)."""
    if ss == 1:
        return im
    return im.resize((max(1, round(im.width / ss)), max(1, round(im.height / ss))), Image.LANCZOS)


def background(w: int, h: int, glow=(0.5, 0.5), reach: float = 1.0) -> Image.Image:
    """Night, a touch lighter round `glow` (as shares of the width and height)."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x - glow[0] * w) / (w / 2), (y - glow[1] * h) / (h / 2)) / reach
    t = np.clip(d, 0, 1)[..., None] ** 0.9
    bg = np.array(NAVY_2, np.float32) + (np.array(NAVY, np.float32) - np.array(NAVY_2, np.float32)) * t
    return Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")


# -- the ping and the name ------------------------------------------------------------------------------------------

def ping(im: Image.Image, cx: float, cy: float, r: float, color=CYAN, rings=RINGS, dot: bool = True,
         ring_alpha: float = 1.0) -> None:
    """Draw the ping on `im`: a dot of radius r and its rings (each ring under whatever is drawn after it)."""
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    width = max(1, round(r * RING_W))
    for k, a in rings:
        rr = r * k
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=color + (round(255 * a * ring_alpha),), width=width)
    if dot:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
    im.alpha_composite(lay)


def tittle(f: ImageFont.FreeTypeFont) -> tuple[int, int, int, int]:
    """The font's own dot of the i, as a box from the pen (baseline 0): what the 'i' has above the dotless 'ı'."""
    S = f.size * 3
    ox, oy = S // 3, S * 2 // 3
    a, b = Image.new("L", (S, S), 0), Image.new("L", (S, S), 0)
    ImageDraw.Draw(a).text((ox, oy), "i", font=f, fill=255, anchor="ls")
    ImageDraw.Draw(b).text((ox, oy), "\u0131", font=f, fill=255, anchor="ls")
    stem_top = np.nonzero(np.asarray(b) > 128)[0].min()
    dot = np.asarray(a) > 128
    dot[stem_top - 1:] = False
    ys, xs = np.nonzero(dot)
    return xs.min() - ox, ys.min() - oy, xs.max() - ox, ys.max() - oy


def logo(height: int, letters=WHITE, ping_color=CYAN, rings: bool = True, ss: int = 4) -> tuple[Image.Image, dict]:
    """blip, `height` px from the top of the b to the baseline, on transparency, cropped tight (rings and the p's
    tail included); with where its parts landed: "ping" (cx, cy, r) and "letters" (their ink box)."""
    probe = font(LOGO_FONT, 400)
    asc = -probe.getbbox("bl", anchor="ls")[1]          # the b's height at size 400
    f = font(LOGO_FONT, 400 * height * ss / asc)
    txt = "bl\u0131p"                                   # the dotless i: the ping is its dot
    x0, base = f.size, int(f.size * 1.6)
    size = (int(f.getlength(txt)) + 2 * f.size, int(f.size * 2.4))
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    l, t, r, b = tittle(f)
    cx, cy = x0 + f.getlength("bl") + (l + r) / 2, base + (t + b) / 2
    rad = (r - l) / 2 * 1.12
    if rings:
        ping(im, cx, cy, rad, ping_color, dot=False)     # the rings behind the letters
    ink = Image.new("L", size, 0)
    ImageDraw.Draw(ink).text((x0, base), txt, font=f, fill=255, anchor="ls")
    ImageDraw.Draw(im).text((x0, base), txt, font=f, fill=letters + (255,), anchor="ls")
    ping(im, cx, cy, rad, ping_color, rings=())          # the dot on top
    box = im.getbbox()
    lb = ink.getbbox()
    at = lambda v, o: (v - o) / ss  # noqa: E731
    info = {"ping": (at(cx, box[0]), at(cy, box[1]), rad / ss),
            "letters": (at(lb[0], box[0]), at(lb[1], box[1]), at(lb[2], box[0]), at(lb[3], box[1]))}
    return reduce(im.crop(box), ss), info


def wordmark(height: int, letters=WHITE, ping_color=CYAN, rings: bool = True) -> Image.Image:
    """The name alone: see logo()."""
    return logo(height, letters, ping_color, rings)[0]


def mark(size: int = 1024, ss: int = 4) -> Image.Image:
    """The ping alone on transparency, `size` px square."""
    S = size * ss
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    outer = max(k for k, _ in RINGS) + RING_W / 2
    ping(im, S / 2, S / 2, S * 0.48 / outer)
    return reduce(im, ss)


# -- the profile picture, the banner, the watermark ----------------------------------------------------------------

def avatar(size: int = 800, kind: str = "name") -> Image.Image:
    """The profile picture on Night, inside the circle every platform crops it to: the name ("name") or the ping
    ("ping")."""
    im = background(size, size, (0.5, 0.42), 0.95)
    if kind == "ping":
        ss = 4
        big = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
        ping(big, size * ss / 2, size * ss / 2, size * ss * 0.105, rings=((2.0, 0.62), (2.9, 0.30), (3.8, 0.12)))
        im.alpha_composite(reduce(big, ss))
    else:
        probe = logo(100)[1]["letters"]
        wm, info = logo(round(100 * size * 0.74 / (probe[2] - probe[0])))   # the letters 74 % of the circle wide
        l, t, r, b = info["letters"]            # centred on the letters, not on the rings (they reach above the b)
        im.alpha_composite(wm, (round(size / 2 - (l + r) / 2), round(size / 2 - (t + b) / 2)))
    return im.convert("RGB")


def round_cut(im: Image.Image, ss: int = 4) -> Image.Image:
    """The square image inside a smooth-edged circle, transparent outside."""
    n = im.width
    m = Image.new("L", (n * ss, n * ss), 0)
    ImageDraw.Draw(m).ellipse([0, 0, n * ss - 1, n * ss - 1], fill=255)
    out = im.convert("RGBA")
    out.putalpha(m.resize((n, n), Image.LANCZOS))
    return out


def scatter(w: int, h: int, n: int, seed: int, keep_out) -> list[tuple[float, float, float]]:
    """n small pings over the banner (x, y, size share), none inside the box `keep_out`."""
    rnd = random.Random(seed)
    pts = []
    while len(pts) < n:
        x, y = rnd.uniform(0.03, 0.97) * w, rnd.uniform(0.05, 0.95) * h
        x0, y0, x1, y1 = keep_out
        if x0 <= x <= x1 and y0 <= y <= y1:
            continue
        if any(math.hypot(x - a, y - b) < w * 0.07 for a, b, _ in pts):
            continue
        pts.append((x, y, rnd.uniform(0.6, 1.0)))
    return pts


def banner(w: int = 2560, h: int = 1440) -> Image.Image:
    """YouTube's channel art: the name in the 1546 x 423 middle every device shows, the ping's rings spreading out
    from it over a faint minimap grid, a few other pings out on the map."""
    sx0, sy0, sw, sh = (w - 1546) // 2, (h - 423) // 2, 1546, 423
    wm, info = logo(196)
    l, t, r, b = info["letters"]
    wx, wy = round(sx0 + sw / 2 - (l + r) / 2), round(sy0 + sh / 2 - (t + b) / 2)
    cx, cy = wx + info["ping"][0], wy + info["ping"][1]
    im = background(w, h, (cx / w, cy / h), 1.25)
    ss = 2
    lay = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    # the grid: thin lines every 120 px, fading out from the middle
    for gx in range(0, w + 1, 120):
        d.line([(gx * ss, 0), (gx * ss, h * ss)], fill=CYAN + (14,), width=ss)
    for gy in range(0, h + 1, 120):
        d.line([(0, gy * ss), (w * ss, gy * ss)], fill=CYAN + (14,), width=ss)
    # the ping's waves, wider and fainter the further they go
    for i, rr in enumerate((330, 520, 760, 1050, 1390)):
        al = int(46 * 0.72 ** i)
        d.ellipse([(cx - rr) * ss, (cy - rr) * ss, (cx + rr) * ss, (cy + rr) * ss], outline=CYAN + (al,),
                  width=max(ss, int((5 - i * 0.6) * ss)))
    lay = reduce(lay, ss)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    fade = np.clip(1.25 - np.hypot((x - cx) / (w * 0.62), (y - cy) / (h * 0.62)), 0, 1)
    lay.putalpha(Image.fromarray((np.asarray(lay.getchannel("A"), np.float32) * fade).astype(np.uint8)))
    im.alpha_composite(lay)
    # other pings out on the map, small and dim, one of them gold; none near the name
    keep = (sx0 - 60, sy0 - 40, sx0 + sw + 60, sy0 + sh + 40)
    big = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    for i, (px, py, k) in enumerate(scatter(w, h, 9, 7, keep)):
        col = GOLD if i == 4 else CYAN
        ping(big, px * 2, py * 2, 2 * 9 * k, col, ring_alpha=0.9)
    small = reduce(big, 2)
    small.putalpha(small.getchannel("A").point(lambda v: int(v * 0.42)))
    im.alpha_composite(small)
    # a soft glow behind the name so it sits on light, then the name
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse([cx - 620, cy - 300, cx + 620, cy + 300], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(160)).point(lambda v: int(v * 0.10))
    gl = Image.new("RGBA", (w, h), CYAN + (0,))
    gl.putalpha(glow)
    im.alpha_composite(gl)
    im.alpha_composite(shadowed(wm, 18, 0.55, 8), (wx - 18 * 3 - 8, wy - 18 * 3 - 8))
    return im.convert("RGB")


def watermark(size: int = 150, kind: str = "name") -> Image.Image:
    """YouTube's video watermark (Studio > Customisation > Branding): the avatar in its circle, transparent round it."""
    return round_cut(avatar(size * 4, kind)).resize((size, size), Image.LANCZOS)


# -- on the short ---------------------------------------------------------------------------------------------------

def corner_bug(height: int = 72) -> Image.Image:
    """The brand on every short (it sits on the seam, left): the name, white, its ping cyan, shadowed to read on any
    frame. `height` is the name's full height, rings included."""
    probe = wordmark(100)
    wm = wordmark(max(8, round(100 * height / probe.height)))
    return shadowed(wm, max(3, height * 0.09), 0.8, max(1, height // 30))


def credit_pill(handle: str = "twitch.tv/streamer", scale: float = 1.0) -> Image.Image:
    """How a clip's creator is credited on screen: a Night pill with a cyan edge, CLIP in gold, the channel in white,
    both words on one baseline."""
    fl, fh = font(LOGO_FONT, 31 * scale), font("Inter-ExtraBold.ttf", 36 * scale)
    lab = "CLIP"
    h = int(68 * scale)
    gap = 16 * scale
    w = int(26 * scale + fl.getlength(lab) + gap + fh.getlength(handle) + 30 * scale)
    ss = 4
    shape = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(shape).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], radius=h * ss // 2, fill=255)
    edge = Image.new("L", shape.size, 0)
    ImageDraw.Draw(edge).rectangle([0, 0, int(9 * scale * ss), h * ss], fill=255)
    edge = Image.fromarray(np.minimum(np.asarray(edge), np.asarray(shape)))
    im = Image.new("RGBA", shape.size, NAVY + (0,))
    im.putalpha(shape.point(lambda v: v * 228 // 255))
    cy = Image.new("RGBA", shape.size, CYAN + (0,))
    cy.putalpha(edge)
    im.alpha_composite(cy)
    im = reduce(im, ss)
    d = ImageDraw.Draw(im)
    cap = -fh.getbbox("T", anchor="ls")[1]              # the handle's cap height
    base = round(h / 2 + cap / 2)                       # caps centred in the pill
    x = 26 * scale
    d.text((x, base), lab, font=fl, fill=GOLD, anchor="ls")
    d.text((x + fl.getlength(lab) + gap, base), handle, font=fh, fill=WHITE, anchor="ls")
    return shadowed(im, 8, 0.6, 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "avatar-800": avatar(800),
        "avatar-400": avatar(400),
        "avatar-ping-800": avatar(800, "ping"),
        "youtube-banner-2560x1440": banner(),
        "youtube-watermark-150": watermark(),
        "mark-2048": mark(2048),
        "mark-512": mark(512),
        "wordmark": wordmark(320),
        "wordmark-dark": wordmark(320, NAVY, (0, 168, 204)),
        "corner-bug": corner_bug(),
        "credit-pill-sample": credit_pill(),
    }
    for name, im in files.items():
        im.save(OUT / f"{PREFIX}-{name}.png", optimize=True)
    print("written:", ", ".join(f"{PREFIX}-{n}.png" for n in files))


if __name__ == "__main__":
    main()
