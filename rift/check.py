"""What a downloaded clip shows and sounds like, to judge whether it can be used:

- a contact sheet of its frames, to look at;
- the streamer's webcam: a face in the same spot through the clip, and whether the cam fills the screen;
- music on stream: AudioSet tags per 10 s (a song with vocals or a music genre, or music all the way through);
- speech: its language and words (Whisper), and words the channel can't post.

Models download on first use: YuNet (faces) to build/models/, the AudioSet tagger and Whisper to the Hugging Face cache.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np

MODELS = Path("build/models")
YUNET_URL = "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx"
TAGGER = "MIT/ast-finetuned-audioset-10-10-0.4593"
WHISPER = "small"
SR = 16000

# AudioSet classes that mean a song or a genre of music is playing, not just game sound or a voice
SONG = ("Singing", "Song", "Rapping", "Vocal music", "Pop music", "Hip hop music", "Rock music", "Electronic music",
        "Dance music", "Techno", "House music", "Dubstep", "Drum and bass", "Electronica", "Trance music",
        "Rhythm and blues", "Soul music", "Reggae", "Funk", "Disco", "Heavy metal", "Punk rock", "Country", "Jazz")
# words a clip can't be posted with (slurs); matched on the transcript and the clip's title
UNPOSTABLE = re.compile(r"\b(n[i1]gg|n-word|nword|f[a@]gg?[o0e]?t?|r[e3]t[a@]rd)", re.I)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,avg_frame_rate:format=duration,size", "-of", "json",
                          str(path)], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    v = next((s for s in d["streams"] if s.get("codec_type") == "video"), {})
    num, den = (v.get("avg_frame_rate") or "0/1").split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    return {"width": v.get("width"), "height": v.get("height"), "fps": round(fps, 2),
            "duration": round(float(d["format"]["duration"]), 2),
            "audio": any(s.get("codec_type") == "audio" for s in d["streams"]),
            "mb": round(int(d["format"]["size"]) / 2 ** 20, 1)}


def sample_frames(path: Path, n: int = 8) -> list[tuple[float, np.ndarray]]:
    cap = cv2.VideoCapture(str(path))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    out = []
    for i in range(n):
        idx = int((i + 0.5) * count / n)
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, img = cap.read()
        if ok:
            out.append((idx / fps, img))
    cap.release()
    return out


def contact_sheet(frames: list[tuple[float, np.ndarray]], out: Path, cols: int = 4, width: int = 480) -> Path:
    tiles = []
    for t, img in frames:
        h, w = img.shape[:2]
        tile = cv2.resize(img, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)
        for color, thick in (((0, 0, 0), 4), ((255, 255, 255), 2)):
            cv2.putText(tile, f"{t:4.1f}s", (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, thick, cv2.LINE_AA)
        tiles.append(tile)
    blank = np.zeros_like(tiles[0])
    rows = [np.hstack(tiles[i:i + cols] + [blank] * (cols - len(tiles[i:i + cols])))
            for i in range(0, len(tiles), cols)]
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
    return out


def yunet_path() -> Path:
    path = MODELS / "yunet.onnx"
    if not path.exists():
        import requests

        path.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(YUNET_URL, timeout=60)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


def faces(frames: list[tuple[float, np.ndarray]], side: int = 960) -> list[list[tuple]]:
    """Per frame, the faces found: (x, y, w, h, score), as fractions of the frame."""
    det, out = None, []
    for _, img in frames:
        h, w = img.shape[:2]
        s = side / max(h, w)
        small = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
        sh, sw = small.shape[:2]
        if det is None:
            det = cv2.FaceDetectorYN.create(str(yunet_path()), "", (sw, sh), 0.75, 0.3, 50)
        det.setInputSize((sw, sh))
        _, found = det.detect(small)
        out.append([] if found is None else
                   [(float(f[0]) / sw, float(f[1]) / sh, float(f[2]) / sw, float(f[3]) / sh, float(f[-1]))
                    for f in found])
    return out


def webcam(per_frame: list[list[tuple]], min_share: float = 0.5) -> dict:
    """The streamer's cam: a face in the same spot in at least `min_share` of the frames."""
    n = len(per_frame)
    found = [(i, b) for i, boxes in enumerate(per_frame) for b in boxes]
    best = None
    for _, b in found:
        cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
        hits = {j for j, c in found if abs(c[0] + c[2] / 2 - cx) < 0.06 and abs(c[1] + c[3] / 2 - cy) < 0.08}
        if best is None or len(hits) > best[0]:
            best = (len(hits), b)
    if n == 0 or best is None or best[0] < max(2, min_share * n):
        return {"cam": False}
    x, y, w, h, _ = best[1]
    cx, cy = x + w / 2, y + h / 2
    where = ("top" if cy < 0.4 else "bottom" if cy > 0.6 else "middle") + "-" + \
            ("left" if cx < 0.4 else "right" if cx > 0.6 else "centre")
    return {"cam": True, "where": where, "face": [round(v, 3) for v in (x, y, w, h)],
            "share": round(best[0] / n, 2), "fullscreen": h > 0.22}


def load_audio(path: Path, sr: int = SR) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


_tagger = None


def audio_tags(wave: np.ndarray, window: float = 10.0) -> list[dict]:
    """AudioSet tags for each `window` seconds: music, speech, the strongest song/genre class, the top four."""
    global _tagger
    import torch

    if _tagger is None:
        from transformers import ASTFeatureExtractor, ASTForAudioClassification

        _tagger = (ASTFeatureExtractor.from_pretrained(TAGGER), ASTForAudioClassification.from_pretrained(TAGGER).eval())
    extract, model = _tagger
    n = int(window * SR)
    chunks = [wave[i:i + n] for i in range(0, len(wave), n) if len(wave[i:i + n]) >= 3 * SR] or [wave]
    inputs = extract(chunks, sampling_rate=SR, return_tensors="pt")
    with torch.no_grad():
        probs = torch.sigmoid(model(**inputs).logits).numpy()
    labels = model.config.id2label
    index = {labels[i]: i for i in range(len(labels))}
    song_ids = [(index[l], l) for l in SONG if l in index]
    out = []
    for k, p in enumerate(probs):
        song_p, song_label = max((float(p[i]), l) for i, l in song_ids)
        out.append({"t": round(k * window, 1), "music": round(float(p[index["Music"]]), 2),
                    "speech": round(float(p[index["Speech"]]), 2), "song": round(song_p, 2), "song_label": song_label,
                    "game_music": round(float(p[index["Video game music"]]), 2) if "Video game music" in index else None,
                    "top": [labels[i] for i in np.argsort(-p)[:4]]})
    return out


def music_verdict(windows: list[dict], song_at: float = 0.3, music_at: float = 0.3) -> str:
    """'song' (a vocal or genre class is heard), 'music' (music in any 10 s window) or 'none'.

    Measured 2026-11-03 on real clips and two songs mixed under them: clips without music score 0.00-0.02; a song
    alone 0.90-0.96, 6-18 dB under the stream 0.55-0.62, 24 dB under 0.35-0.51, 30 dB under 0.10-0.48. The genre
    classes stay low even for a song alone (0.15-0.20), so the music score does the work."""
    if not windows:
        return "none"
    if max(w["song"] for w in windows) >= song_at:
        return "song"
    if max(w["music"] for w in windows) >= music_at:
        return "music"
    return "none"


_whisper = {}


def speech(wave: np.ndarray, model: str = WHISPER) -> dict:
    from faster_whisper import WhisperModel

    if model not in _whisper:
        _whisper[model] = WhisperModel(model, device="cpu", compute_type="int8")
    segments, info = _whisper[model].transcribe(wave, beam_size=1, vad_filter=True, condition_on_previous_text=False)
    segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments]
    text = " ".join(s["text"] for s in segs).strip()
    return {"language": info.language, "language_p": round(info.language_probability, 2),
            "words": len(text.split()), "text": text, "segments": segs}


def unpostable(*texts: str) -> list[str]:
    return sorted({m.group(0).lower() for t in texts if t for m in UNPOSTABLE.finditer(t)})


def check(clip: dict, path: Path, sheet: Path) -> dict:
    frames = sample_frames(path)
    contact_sheet(frames, sheet)
    wave = load_audio(path)
    tags = audio_tags(wave)
    talk = speech(wave)
    return {"probe": probe(path), "sheet": str(sheet), "cam": webcam(faces(frames)),
            "music": music_verdict(tags), "audio": tags, "speech": talk,
            "unpostable": unpostable(talk["text"], clip.get("title", ""))}
