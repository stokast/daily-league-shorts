"""Render a Blip short from a recipe (shorts/<date>-<slug>.json).

The format, 1080 x 1920 at the stream's frame rate:
- the streamer's cam on top (CAM_H px high), over a blurred copy of itself where it's narrower than the frame;
- the play below: one fixed crop of the stream, zoomed to fill the rest. No cam: the play fills the frame;
- on the seam: the Blip tag on the left, the credit pill (CLIP twitch.tv/<streamer>) on the right, a line between
  them that never runs under either; every short opens with them coming in (INTRO): the name lands with one ping,
  the line draws itself to the credit, the credit slides in, all within the first second;
- the hook: two lines at the top of the play for the first seconds; all the short's own text in Montserrat;
- captions: the streamer's words (Whisper word times), up to three at a time, the spoken word in gold, swears starred
  (the sound stays as recorded);
- an optional replay after the clip: the play again, slowed and zoomed tighter, with numbered steps, a whoosh in
  and an impact on the moment that matters.
Sound: the stream as recorded plus those two sounds, then one static gain to about -14 LUFS (no compressor).

    python -m rift short shorts/2026-11-03-peyz-gromp.json [--draft]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from brand import make_brand as brand  # noqa: E402

W, H = 1080, 1920
CAM_H = 600
STEPS_Y = 1390  # replay steps: the lower third, clear of the play's top and of the apps' bottom bars
SEAM = CAM_H
FONT_HOOK = ROOT / "brand/fonts/Montserrat-Black.ttf"         # the shorts' own type: Montserrat, the usual one
FONT_LABEL = ROOT / "brand/fonts/Montserrat-ExtraBold.ttf"
FONT_CAPTION = ROOT / "brand/fonts/Montserrat-ExtraBold.ttf"
INTRO = {"tag": 0.0, "ping": 0.12, "line": 0.22, "line_s": 0.7, "pill": 0.6}  # the brand's entrance, in seconds
SOUNDS = ROOT / "assets/sfx"  # local copies from the editor's pack (never committed); see README
TARGET_LUFS, CEILING_DBTP = -14.0, -1.0
MAX_LIMIT_DB = 4.0  # the limiter takes at most this much off the peaks; a clip with clipped shouts ends quieter
SWEARS = {"fuck": "F**K", "fucking": "F**KING", "fucked": "F**KED", "shit": "SH*T", "bitch": "B*TCH",
          "motherfucker": "MOTHERF**KER"}


# -- recipe and layout ---------------------------------------------------------------------------------------------

def load(path: Path) -> dict:
    r = json.loads(Path(path).read_text())
    r["_path"] = str(path)
    r.setdefault("hook_until", 2.8)
    r.setdefault("cam", None)
    return r


def panel_size(has_cam: bool) -> tuple[int, int]:
    return (W, H - CAM_H) if has_cam else (W, H)


def fit_crop(box, aspect: float, frame=(1920, 1080)) -> tuple[int, int, int, int]:
    """The crop box adjusted to `aspect` (w/h): same height and centre, width changed, kept inside the frame."""
    x, y, w, h = box
    nw = int(round(h * aspect))
    cx = x + w / 2
    nx = int(round(min(max(cx - nw / 2, 0), frame[0] - nw)))
    return nx, int(y), nw, int(h)


def censor(word: str) -> str:
    core = re.sub(r"[^\w']", "", word).lower()
    if core in SWEARS:
        return re.sub(re.escape(re.sub(r"[^\w']", "", word)), SWEARS[core], word, flags=re.I).upper()
    return word.upper()


def caption_text(word: str) -> str:
    """How a word shows: upper case, swears starred, commas and full stops dropped (? and ! kept)."""
    return censor(word).rstrip(",.;:").strip()


def chunk_words(words: list[dict], t0: float, t1: float, max_words: int = 3, max_chars: int = 16,
                gap: float = 0.45) -> list[dict]:
    """Words inside [t0, t1] (source times) grouped for captions: up to `max_words` words and `max_chars` letters,
    split at pauses over `gap` s and at the end of a sentence. Times come back relative to t0."""
    inside = [w for w in words if w["start"] >= t0 - 0.05 and w["end"] <= t1 + 0.05 and caption_text(w["w"])]
    chunks, cur = [], []
    for w in inside:
        text = caption_text(w["w"])
        if cur:
            prev = cur[-1]
            joined = len(" ".join(c["text"] for c in cur)) + 1 + len(text)
            if (len(cur) >= max_words or joined > max_chars or (w["start"] - t0) - prev["end"] > gap
                    or prev["stop"]):
                chunks.append(cur)
                cur = []
        cur.append({"text": text, "start": max(0.0, w["start"] - t0), "end": max(0.0, w["end"] - t0),
                    "stop": w["w"].rstrip().endswith((".", "?", "!"))})  # a sentence ends: the line ends
    if cur:
        chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        start = c[0]["start"]
        end = max(c[-1]["end"] + 0.2, start + 0.5)
        if i + 1 < len(chunks):
            end = min(end, chunks[i + 1][0]["start"])
        out.append({"start": start, "end": end, "words": c})
    return out


# -- drawing -------------------------------------------------------------------------------------------------------

def rgba(im: Image.Image) -> np.ndarray:
    """PIL RGBA -> float32 BGRA array, colour premultiplied by alpha, both 0..1."""
    a = np.asarray(im.convert("RGBA"), np.float32) / 255.0
    out = np.empty_like(a)
    out[..., :3] = a[..., 2::-1] * a[..., 3:4]
    out[..., 3] = a[..., 3]
    return out


def blend(frame: np.ndarray, ov: np.ndarray, x: int, y: int, alpha: float = 1.0) -> None:
    h, w = ov.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(frame.shape[1], x + w), min(frame.shape[0], y + h)
    if x0 >= x1 or y0 >= y1 or alpha <= 0:
        return
    o = ov[y0 - y:y1 - y, x0 - x:x1 - x]
    a = o[..., 3:4] * alpha
    region = frame[y0:y1, x0:x1].astype(np.float32) / 255.0
    frame[y0:y1, x0:x1] = np.clip((region * (1 - a) + o[..., :3] * alpha) * 255.0 + 0.5, 0, 255).astype(np.uint8)


def scaled(ov: np.ndarray, s: float) -> np.ndarray:
    if abs(s - 1) < 1e-3:
        return ov
    return cv2.resize(ov, (max(1, round(ov.shape[1] * s)), max(1, round(ov.shape[0] * s))),
                      interpolation=cv2.INTER_LINEAR)


def stroked(lines: list[tuple[str, tuple]], font_path: Path, size: int, stroke: int, max_w: int = 1000,
            line_gap: float = 0.92) -> Image.Image:
    """Lines of text, each in its colour, with a Night stroke and a soft shadow; shrunk to fit `max_w`."""
    while True:
        f = ImageFont.truetype(str(font_path), size)
        widths = [f.getlength(t) + 2 * stroke for t, _ in lines]
        if max(widths) <= max_w or size <= 24:
            break
        size = int(size * 0.94)
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * line_gap)
    w = int(max(widths)) + 8
    h = lh * len(lines) + 2 * stroke + 8
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (t, col) in enumerate(lines):
        d.text((w / 2, stroke + 4 + i * lh), t, font=f, fill=col + (255,), stroke_width=stroke,
               stroke_fill=brand.NAVY + (255,), anchor="ma")
    return brand.shadowed(im, max(4, stroke), 0.75, max(2, stroke // 2))


def caption_states(chunk: dict, size: int = 74) -> list[tuple[float, float, np.ndarray]]:
    """One image per spoken word of a chunk: the whole line, that word in gold."""
    f = ImageFont.truetype(str(FONT_CAPTION), size)
    texts = [w["text"] for w in chunk["words"]]
    stroke = max(5, size // 11)
    space = f.getlength(" ")
    total = sum(f.getlength(t) for t in texts) + space * (len(texts) - 1) + 2 * stroke + 8
    scale = min(1.0, 980 / total)
    if scale < 1:
        f = ImageFont.truetype(str(FONT_CAPTION), int(size * scale))
        stroke = max(4, int(stroke * scale))
        space = f.getlength(" ")
        total = sum(f.getlength(t) for t in texts) + space * (len(texts) - 1) + 2 * stroke + 8
    asc, desc = f.getmetrics()
    states = []
    for k, word in enumerate(chunk["words"]):
        im = Image.new("RGBA", (int(total), asc + desc + 2 * stroke + 8), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = stroke + 4
        for j, t in enumerate(texts):
            col = brand.GOLD if j == k else brand.WHITE
            d.text((x, stroke + 4), t, font=f, fill=col + (255,), stroke_width=stroke,
                   stroke_fill=brand.NAVY + (255,))
            x += f.getlength(t) + space
        start = word["start"] if k else chunk["start"]
        end = chunk["words"][k + 1]["start"] if k + 1 < len(chunk["words"]) else chunk["end"]
        states.append((start, max(end, start + 1 / 60), rgba(brand.shadowed(im, 6, 0.7, 3))))
    return states


def chip(text: str, size: int = 40, fg=brand.NAVY, bg=brand.CYAN) -> Image.Image:
    f = ImageFont.truetype(str(FONT_LABEL), size)
    pad_x, h = int(size * 0.55), int(size * 1.45)
    w = int(f.getlength(text) + 2 * pad_x)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(size * 0.3), fill=bg + (255,))
    d.text((w / 2, h / 2), text, font=f, fill=fg + (255,), anchor="mm")
    return brand.shadowed(im, 6, 0.6, 2)


def seam_line(n: int, h: int = 4) -> np.ndarray:
    """The line on the seam, n px long between the name and the credit: cyan at the name into gold at the credit,
    its ends rounded."""
    t = np.linspace(0, 1, n, dtype=np.float32)[None, :, None]
    cyan, gold = np.array(brand.CYAN[::-1], np.float32) / 255, np.array(brand.GOLD[::-1], np.float32) / 255
    col = cyan * (1 - t) + gold * t
    a = np.ones((h, n), np.float32)
    r = h / 2
    yy = np.arange(h, dtype=np.float32)[:, None] + 0.5 - r
    for xs in (np.arange(0, int(r) + 1), n - 1 - np.arange(0, int(r) + 1)):  # the round caps
        for x in xs:
            dx = (r - 0.5 - min(x, n - 1 - x))
            a[:, x] = np.clip(r - np.sqrt(np.maximum(0, dx) ** 2 + yy[:, 0] ** 2) + 0.5, 0, 1)
    ov = np.empty((h, n, 4), np.float32)
    ov[..., :3] = np.repeat(col, h, axis=0) * a[..., None]
    ov[..., 3] = a
    return ov


def ease_out(k: float, p: float = 3.0) -> float:
    return 1 - (1 - min(1.0, max(0.0, k))) ** p


class SeamLine:
    """The seam's line drawing itself from the name to the credit (ease-out), a soft light running at its tip, then
    still for the rest of the short."""

    def __init__(self, x0: int, x1: int, y: int, t0: float, dur: float, h: int = 4):
        self.img, self.x0, self.y, self.t0, self.dur = seam_line(x1 - x0, h), x0, y, t0, dur
        self.x, self.t1 = x0, 1e9  # like a Layer: where it is and when it shows
        gw, gh = 72, 26  # the tip's light: a soft white-cyan glow
        yy, xx = np.mgrid[0:gh, 0:gw].astype(np.float32)
        g = np.exp(-(((xx - gw / 2) / (gw / 5)) ** 2 + ((yy - gh / 2) / (gh / 5)) ** 2))
        col = (np.array([1.0, 1.0, 1.0], np.float32) * 0.6 + np.array(brand.CYAN[::-1], np.float32) / 255 * 0.4)
        self.glow = np.empty((gh, gw, 4), np.float32)
        self.glow[..., :3] = col * g[..., None]
        self.glow[..., 3] = g

    def draw(self, frame: np.ndarray, t: float) -> None:
        if t < self.t0:
            return
        k = (t - self.t0) / self.dur
        w = self.img.shape[1] if k >= 1 else int(round(ease_out(k) * self.img.shape[1]))
        if w > 0:
            blend(frame, self.img[:, :w], self.x0, self.y)
        if k < 1:
            gh, gw = self.glow.shape[:2]
            blend(frame, self.glow, self.x0 + w - gw // 2, self.y + self.img.shape[0] // 2 - gh // 2,
                  0.85 * (1 - k) ** 0.7)


class PingRing:
    """One ring spreading out of the logo's ping as the name lands, the way a ping lands on the minimap."""

    def __init__(self, cx: float, cy: float, r: float, t0: float, dur: float = 0.8, reach: float = 6.0):
        self.cx, self.cy, self.r, self.t0, self.dur, self.reach = cx, cy, r, t0, dur, reach
        self.x, self.y, self.t1 = cx, cy, t0 + dur  # like a Layer: where it is and when it shows

    def draw(self, frame: np.ndarray, t: float) -> None:
        k = (t - self.t0) / self.dur
        if not 0 <= k < 1:
            return
        rr = self.r * (1.3 + (self.reach - 1.3) * ease_out(k, 2.2))
        width = max(1.5, self.r * 0.42 * (1 - 0.5 * k))
        n = int(2 * (rr + width) + 6)
        patch = np.zeros((n, n), np.uint8)
        c = n / 2
        cv2.circle(patch, (int(c * 16), int(c * 16)), int(rr * 16), 255, max(1, int(round(width))), cv2.LINE_AA,
                   shift=4)
        a = patch.astype(np.float32) / 255
        ov = np.empty((n, n, 4), np.float32)
        ov[..., :3] = (np.array(brand.CYAN[::-1], np.float32) / 255) * a[..., None]
        ov[..., 3] = a
        blend(frame, ov, int(round(self.cx - c)), int(round(self.cy - c)), 0.9 * (1 - k) ** 1.4)


class Layer:
    """An overlay shown from t0 to t1 (output seconds), popping in over `pop` s and fading out over `fade` s."""

    def __init__(self, img: np.ndarray, x, y, t0: float, t1: float, pop: float = 0.0, fade: float = 0.0,
                 grow: float = 0.12, anchor: str = "tl", slide: tuple = (0, 0)):
        self.img, self.x, self.y, self.t0, self.t1 = img, x, y, t0, t1
        self.pop, self.fade, self.grow, self.anchor, self.slide = pop, fade, grow, anchor, slide

    def draw(self, frame: np.ndarray, t: float) -> None:
        if not (self.t0 <= t < self.t1):
            return
        a, s, dx, dy = 1.0, 1.0, 0.0, 0.0
        if self.pop and t - self.t0 < self.pop:
            k = (t - self.t0) / self.pop
            a = min(1.0, k * 1.6)
            s = 1 + self.grow * (1 - k) ** 2
            dx, dy = (v * (1 - ease_out(k)) for v in self.slide)
        if self.fade and self.t1 - t < self.fade:
            a *= max(0.0, (self.t1 - t) / self.fade)
        img = scaled(self.img, s)
        h, w = img.shape[:2]
        x = int(round(self.x + dx - (w / 2 if "c" in self.anchor else w if "r" in self.anchor else 0)))
        y = int(round(self.y + dy - (h / 2 if "m" in self.anchor else 0)))
        blend(frame, img, x, y, a)


# -- picture -------------------------------------------------------------------------------------------------------

def probe_fps(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True).stdout.strip()
    num, den = out.split("/")
    return float(num) / float(den)


def frames(path: Path, t0: float, n: int, size=(1920, 1080)):
    """n frames of the source from t0 on, as BGR arrays."""
    w, h = size
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{t0:.4f}", "-i", str(path), "-frames:v", str(n),
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    try:
        for _ in range(n):
            buf = p.stdout.read(w * h * 3)
            if len(buf) < w * h * 3:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    finally:
        p.stdout.close()
        p.wait()


def crop(img: np.ndarray, box) -> np.ndarray:
    x, y, w, h = box
    return img[y:y + h, x:x + w]


def cam_panel(cam: np.ndarray) -> np.ndarray:
    h, w = cam.shape[:2]
    cw = int(round(w * CAM_H / h))
    if cw >= W:
        big = cv2.resize(cam, (cw, CAM_H), interpolation=cv2.INTER_CUBIC)
        off = (cw - W) // 2
        return big[:, off:off + W]
    small = cv2.resize(cam, (96, max(8, round(96 * CAM_H / W))), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.GaussianBlur(small, (0, 0), 2.5), (W, CAM_H), interpolation=cv2.INTER_LINEAR)
    bg = (bg.astype(np.float32) * 0.5).astype(np.uint8)
    off = (W - cw) // 2
    bg[:, off:off + cw] = cv2.resize(cam, (cw, CAM_H), interpolation=cv2.INTER_CUBIC)
    return bg


def compose(cam: np.ndarray | None, game: np.ndarray) -> np.ndarray:
    canvas = np.empty((H, W, 3), np.uint8)
    pw, ph = panel_size(cam is not None)
    if cam is not None:
        canvas[:CAM_H] = cam_panel(cam)
    canvas[H - ph:] = cv2.resize(game, (pw, ph), interpolation=cv2.INTER_CUBIC)
    return canvas


# -- the short -----------------------------------------------------------------------------------------------------

def timeline(r: dict, fps: float) -> dict:
    t0, t1 = r["trim"]
    main_n = int(round((t1 - t0) * fps))
    rep = r.get("replay")
    rep_n = int(round((rep["to"] - rep["from"]) / rep["speed"] * fps)) if rep else 0
    return {"main_n": main_n, "main_s": main_n / fps, "rep_n": rep_n, "rep_s": rep_n / fps,
            "total_s": (main_n + rep_n) / fps}


def layers(r: dict, tl: dict) -> list[Layer]:
    has_cam = r["cam"] is not None
    top = SEAM if has_cam else 0
    out = []
    tag_im, tag_at = brand.corner_bug(62, info=True)
    tag = rgba(tag_im)
    pill = rgba(brand.credit_pill(r["clip"]["credit"], 0.92))
    seam_y = SEAM if has_cam else 300
    tag_x, pill_x = 26, W - 26 - pill.shape[1]
    tag_top = seam_y - tag.shape[0] / 2
    # the brand's entrance: the name lands with one ping, the line draws from it to the credit, the credit slides in.
    # The line stops short of both, so it never runs through the letters.
    if has_cam:
        body = np.nonzero(pill[..., 3].max(axis=0) > 0.75)[0]   # the pill itself, not its shadow
        x0 = int(tag_x + tag_at["letters"][2] + 14)
        x1 = int(pill_x + body[0] - 14)
        out.append(SeamLine(x0, x1, SEAM - 2, INTRO["line"], INTRO["line_s"]))
    out.append(Layer(tag, tag_x, seam_y, INTRO["tag"], 1e9, anchor="tm", pop=0.3, grow=-0.08))
    cx, cy, pr = tag_at["ping"]
    out.append(PingRing(tag_x + cx, tag_top + cy, pr, INTRO["ping"]))
    out.append(Layer(pill, pill_x, seam_y, INTRO["pill"], 1e9, anchor="tm", pop=0.32, grow=0, slide=(28, 0)))
    if r.get("hook"):
        cols = [brand.WHITE, brand.CYAN]
        hook = stroked([(t, cols[i % 2]) for i, t in enumerate(r["hook"])], FONT_HOOK, 96, 8, max_w=1000)
        out.append(Layer(rgba(hook), W / 2, top + 78, 0.05, r["hook_until"], pop=0.2, fade=0.2, anchor="tc"))
    words = json.loads((ROOT / r["words"]).read_text()) if r.get("words") else []
    cap_y = CAM_H - 112 if has_cam else 1300
    for ch in chunk_words(words, *r["trim"]):
        for i, (s, e, img) in enumerate(caption_states(ch)):
            out.append(Layer(img, W / 2, cap_y, s, min(e, tl["main_s"]), pop=0.1 if i == 0 else 0, grow=0.08,
                             anchor="cm"))
    rep = r.get("replay")
    if rep:
        base = tl["main_s"]
        out.append(Layer(rgba(chip(f"REPLAY  {rep['speed']:g}x", 36)), W - 22, top + 46, base, base + tl["rep_s"],
                         pop=0.15, anchor="tr"))
        steps = rep.get("steps", [])
        for i, (ts, text) in enumerate(steps):
            s = base + (ts - rep["from"]) / rep["speed"]
            e = base + ((steps[i + 1][0] - rep["from"]) / rep["speed"] if i + 1 < len(steps) else tl["rep_s"])
            img = stroked([(f"{i + 1}  {text}", brand.WHITE)], FONT_HOOK, 70, 7, max_w=1000)
            out.append(Layer(rgba(img), W / 2, STEPS_Y, s, e, pop=0.18, anchor="tc"))
        flash = np.full((H, W, 4), 0.7, np.float32)  # white at 70 %
        out.append(Layer(flash, 0, 0, base, base + 0.14, fade=0.14))
    return out


def picture(r: dict, out: Path, fps: float, draft: bool) -> None:
    src = ROOT / r["source"]
    tl = timeline(r, fps)
    has_cam = r["cam"] is not None
    pw, ph = panel_size(has_cam)
    game_box = fit_crop(r["game"], pw / ph)
    lays = layers(r, tl)
    enc = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", f"{fps:.6f}", "-i", "-", "-c:v", "libx264", "-preset",
                            "veryfast" if draft else "medium", "-crf", "26" if draft else "18", "-pix_fmt", "yuv420p",
                            str(out)], stdin=subprocess.PIPE)

    def emit(canvas, t):
        for lay in lays:
            lay.draw(canvas, t)
        enc.stdin.write(canvas.tobytes())

    for i, f in enumerate(frames(src, r["trim"][0], tl["main_n"])):
        emit(compose(crop(f, r["cam"]) if has_cam else None, crop(f, game_box)), i / fps)
    rep = r.get("replay")
    if rep:
        rbox = fit_crop(rep["game"], pw / ph)
        n_src = int(round((rep["to"] - rep["from"]) * fps)) + 2
        held = [(crop(f, r["cam"]).copy() if has_cam else None, crop(f, rbox).copy())
                for f in frames(src, rep["from"], n_src)]
        for k in range(tl["rep_n"]):
            fi = k * rep["speed"]
            i0 = min(int(fi), len(held) - 1)
            i1 = min(i0 + 1, len(held) - 1)
            a = fi - int(fi)
            mix = lambda p, q: cv2.addWeighted(p, 1 - a, q, a, 0) if a > 0.01 else p  # noqa: E731
            cam = mix(held[i0][0], held[i1][0]) if has_cam else None
            emit(compose(cam, mix(held[i0][1], held[i1][1])), tl["main_s"] + k / fps)
    enc.stdin.close()
    if enc.wait():
        raise RuntimeError("the encoder failed")


# -- sound ---------------------------------------------------------------------------------------------------------

def loudness(path: Path) -> tuple[float, float]:
    """Integrated loudness (LUFS) and true peak (dBTP)."""
    err = subprocess.run(["ffmpeg", "-nostdin", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return i, tp


def sound(r: dict, out: Path, fps: float) -> dict:
    src = ROOT / r["source"]
    tl = timeline(r, fps)
    t0 = r["trim"][0]
    if r.get("gains"):  # quiet stretches of the stream lifted by a static gain each, 60 ms ramps (no compressor)
        lifted = out.with_suffix(".src.wav")
        chain = f"aresample=48000,volume='{gain_expr(r['gains'])}':eval=frame"
        if r.get("pre_limit_db") is not None:  # shave the lifted game's sharp hits before the mix (a fast limiter)
            chain += f",alimiter=limit={10 ** (r['pre_limit_db'] / 20):.4f}:attack=3:release=40:level=disabled"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-vn", "-af", chain, "-ac", "2",
                        str(lifted)], check=True)
        src = lifted
    inputs = ["-i", str(src)]
    graph = [f"[0:a]atrim=start={t0:.4f}:duration={tl['main_s']:.4f},asetpts=PTS-STARTPTS,aresample=48000,"
             f"aformat=channel_layouts=stereo[main]"]
    mix = ["[main]"]
    cues = [(name, at - t0, db) for at, name, db in r.get("sfx", []) if t0 <= at < r["trim"][1]]
    rep = r.get("replay")
    if rep:
        sp = rep["speed"]
        graph[0] = graph[0].replace("[main]", "[m0]")
        graph.append(f"[0:a]atrim=start={rep['from']:.4f}:duration={rep['to'] - rep['from']:.4f},asetpts=PTS-STARTPTS,"
                     f"aresample=48000,asetrate={48000 * sp:.0f},aresample=48000,volume={rep.get('slow_gain_db', -4)}dB,"
                     f"atrim=duration={tl['rep_s']:.4f}[rep]")
        graph.append("[m0][rep]concat=n=2:v=0:a=1[st]")
        mix = ["[st]"]
        cues.append(("whoosh", tl["main_s"] - 0.12, rep.get("whoosh_db", -8)))
        if rep.get("impact_at") is not None:
            hit = tl["main_s"] + (rep["impact_at"] - rep["from"]) / sp
            cues.append(("impact", hit, rep.get("impact_db", -10)))
            if rep.get("riser_db") is not None:  # a riser that ends on the impact, for the slowed build-up
                cues.append(("riser", hit - sound_length(SOUNDS / "riser.ogg"), rep["riser_db"]))
    for k, (name, at, db) in enumerate(cues, start=1):
        inputs += ["-i", str(SOUNDS / f"{name}.ogg")]
        ms = max(0, int(at * 1000))
        graph.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={db}dB,"
                     f"adelay={ms}|{ms},apad=whole_dur={tl['total_s']:.4f}[s{k}]")
        mix.append(f"[s{k}]")
    # every input padded to the full length and mixed to the longest: amix's duration=first ends the mix at the
    # concat's first segment (ffmpeg 2026-11), which dropped the whole replay's sound
    graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=longest:normalize=0[pre]" if len(mix) > 1
                 else f"{mix[0]}anull[pre]")
    raw = out.with_suffix(".pre.wav")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(graph), "-map", "[pre]",
                    "-ac", "2", "-t", f"{tl['total_s']:.4f}", str(raw)], check=True)
    lufs, tp = loudness(raw)
    gain = min(TARGET_LUFS - lufs, CEILING_DBTP + MAX_LIMIT_DB - tp)  # one static gain; the limiter trims peaks
    limit = 10 ** (CEILING_DBTP / 20)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(raw), "-af",
                    f"volume={gain:.2f}dB,alimiter=limit={limit:.4f}:attack=5:release=60:level=disabled", str(out)],
                   check=True)
    raw.unlink()
    if src != ROOT / r["source"]:
        src.unlink()
    after, tp_after = loudness(out)
    return {"lufs_before": lufs, "peak_before": tp, "gain_db": round(gain, 2), "lufs_after": round(after, 1),
            "limited_db": round(max(0.0, tp + gain - CEILING_DBTP), 1), "peak_after": tp_after}


def sound_length(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def gain_expr(gains: list, ramp: float = 0.06) -> str:
    """An ffmpeg volume expression over source time: each [from, to, dB] stretch at its gain, with linear ramps."""
    parts = []
    for a, b, db in gains:
        g = 10 ** (db / 20)
        parts.append(f"(1+{g - 1:.5f}*clip(min((t-{a})/{ramp},({b}-t)/{ramp}),0,1))")
    return "*".join(parts) or "1"


def render(path: Path, draft: bool = False) -> Path:
    r = load(path)
    src = ROOT / r["source"]
    fps = probe_fps(src)
    outdir = ROOT / "renders"
    outdir.mkdir(exist_ok=True)
    stem = Path(path).stem + ("_draft" if draft else "")
    pic, wav, out = outdir / f"{stem}.video.mp4", outdir / f"{stem}.wav", outdir / f"{stem}.mp4"
    picture(r, pic, fps, draft)
    level = sound(r, wav, fps)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(pic), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)],
                   check=True)
    pic.unlink()
    wav.unlink()
    if r.get("post", {}).get("title") and not draft:
        from . import post
        out.with_suffix(".txt").write_text(post.sheet(r["post"]["title"], r["clip"]["credit"]))
    tl = timeline(r, fps)
    print(f"{out.relative_to(ROOT)}: {tl['total_s']:.2f} s, {out.stat().st_size / 2**20:.1f} MB, "
          f"sound {level['lufs_before']:.1f} -> {level['lufs_after']} LUFS ({level['gain_db']:+.1f} dB, "
          f"limiter on {level['limited_db']} dB of peaks, peak {level['peak_after']:.1f} dBTP)")
    return out
