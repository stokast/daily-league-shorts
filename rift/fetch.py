"""Download a Twitch clip as an mp4, at the best quality Twitch serves (yt-dlp)."""
from __future__ import annotations

from pathlib import Path


def clip_file(clip: dict, dest: Path) -> Path:
    return Path(dest) / f"{clip['id']}.mp4"


def download(clip: dict, dest: Path) -> Path:
    out = clip_file(clip, dest)
    if out.exists() and out.stat().st_size > 0:
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    import yt_dlp

    opts = {"outtmpl": str(out), "format": "best[ext=mp4]/best", "quiet": True, "no_warnings": True,
            "noprogress": True, "retries": 3}
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([clip["url"]])
    if not out.exists() or out.stat().st_size == 0:
        raise RuntimeError(f"no file came down for {clip['url']}")
    return out
