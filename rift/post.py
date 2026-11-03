"""The texts to paste with each short: brand/BRAND.md's templates, where only the title and the streamer change.

The contact email is set once, in the environment (RIFT_CONTACT_EMAIL); without it the placeholder stays.
"""
from __future__ import annotations

import os

YOUTUBE = ("🎥 Clip: {credit} (go follow!)\n\n"
           "⚡ Rift Daily: League's best clip, every day. Subscribe for tomorrow's.\n\n"
           "All clips belong to their creators. Streamers: want this one credited differently or taken down? "
           "Email {email} and it's handled within 24h. Not endorsed by Riot Games.\n\n"
           "#leagueoflegends #lol #shorts")
TIKTOK = "{title}\n\n🎥 {credit}\n#leagueoflegends #lol #leagueclips #gaming #riftdaily"
INSTAGRAM = "{title}\n\n🎥 {credit}\nFollow @riftdaily for one every day ⚡\n#leagueoflegends #lol #leagueclips #gaming #esports"


def texts(title: str, credit: str, email: str | None = None) -> dict:
    email = email or os.environ.get("RIFT_CONTACT_EMAIL") or "CONTACT_EMAIL"
    v = {"title": title, "credit": credit, "email": email}
    return {"YouTube title": title, "YouTube description": YOUTUBE.format(**v), "TikTok caption": TIKTOK.format(**v),
            "Instagram caption": INSTAGRAM.format(**v)}


def sheet(title: str, credit: str, email: str | None = None) -> str:
    return "\n\n".join(f"{k.upper()}\n{v}" for k, v in texts(title, credit, email).items()) + "\n"
