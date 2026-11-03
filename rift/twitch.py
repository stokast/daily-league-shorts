"""Twitch Helix: an app token from the environment, and a game's most viewed clips over a window.

The credentials are read from TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and never printed, logged or written to disk;
error messages carry only the HTTP status and Twitch's own error text.
"""
from __future__ import annotations

import datetime as dt
import os

import requests

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
HELIX = "https://api.twitch.tv/helix"
LEAGUE = "League of Legends"
SAME_MOMENT_S = 120  # clips of one broadcaster made this close together, with no VOD to compare, are one moment


class TwitchError(RuntimeError):
    pass


def credentials(env=os.environ) -> tuple[str, str]:
    cid, secret = env.get("TWITCH_CLIENT_ID", "").strip(), env.get("TWITCH_CLIENT_SECRET", "").strip()
    if not cid or not secret:
        raise TwitchError("set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in the environment (the cloud environment's "
                          "secrets); they are never read from the repo")
    return cid, secret


def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_time(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def _error_text(r) -> str:
    try:
        body = r.json()
        return str(body.get("message") or body.get("error") or "")[:200]
    except ValueError:
        return ""


class Helix:
    """A small Helix client: one app access token (client credentials), fetched on first use."""

    def __init__(self, client_id: str, client_secret: str, session=None, timeout: float = 20):
        self.client_id = client_id
        self._secret = client_secret
        self.session = session or requests.Session()
        self.timeout = timeout
        self._token: str | None = None

    def __repr__(self) -> str:  # never show the secret or the token
        return "Helix(client_id=<set>)"

    def token(self) -> str:
        if self._token is None:
            r = self.session.post(TOKEN_URL, data={"client_id": self.client_id, "client_secret": self._secret,
                                                   "grant_type": "client_credentials"}, timeout=self.timeout)
            if r.status_code != 200:
                raise TwitchError(f"Twitch refused the app token: HTTP {r.status_code} {_error_text(r)}".strip())
            self._token = r.json()["access_token"]
        return self._token

    def get(self, path: str, params: dict) -> dict:
        for attempt in range(2):
            headers = {"Client-Id": self.client_id, "Authorization": "Bearer " + self.token()}
            r = self.session.get(HELIX + path, params=params, headers=headers, timeout=self.timeout)
            if r.status_code == 401 and attempt == 0:  # the token expired: fetch a new one once
                self._token = None
                continue
            if r.status_code != 200:
                raise TwitchError(f"GET {path}: HTTP {r.status_code} {_error_text(r)}".strip())
            return r.json()
        raise TwitchError(f"GET {path}: unauthorized")

    def game_id(self, name: str = LEAGUE) -> str:
        data = self.get("/games", {"name": name}).get("data") or []
        if not data:
            raise TwitchError(f"Twitch has no game named {name!r}")
        return data[0]["id"]

    def top_clips(self, game_id: str, since: dt.datetime, until: dt.datetime, limit: int = 300) -> list[dict]:
        """The game's clips created in [since, until], most viewed first (up to `limit`)."""
        clips, cursor = [], None
        while len(clips) < limit:
            params = {"game_id": game_id, "started_at": iso(since), "ended_at": iso(until), "first": 100}
            if cursor:
                params["after"] = cursor
            page = self.get("/clips", params)
            data = page.get("data") or []
            clips += data
            cursor = (page.get("pagination") or {}).get("cursor")
            if not cursor or not data:
                break
        seen, unique = set(), []
        for c in clips:
            if c["id"] not in seen:
                seen.add(c["id"])
                unique.append(c)
        unique.sort(key=lambda c: c.get("view_count", 0), reverse=True)
        return unique[:limit]


def same_moment(a: dict, b: dict, window: float = SAME_MOMENT_S) -> bool:
    """Two clips of one broadcaster showing the same moment: their VOD spans overlap, or, without a VOD to compare,
    they were made within `window` seconds of each other."""
    if a["broadcaster_id"] != b["broadcaster_id"]:
        return False
    va, vb = a.get("video_id"), b.get("video_id")
    oa, ob = a.get("vod_offset"), b.get("vod_offset")
    if va and va == vb and oa is not None and ob is not None:
        return oa < ob + b.get("duration", 0) and ob < oa + a.get("duration", 0)
    return abs((parse_time(a["created_at"]) - parse_time(b["created_at"])).total_seconds()) <= window


def mark_duplicates(clips: list[dict]) -> list[dict]:
    """Clips in view order, each with `rank` (1 = most viewed) and `dup_of` (the id of a more viewed clip of the same
    moment, else None)."""
    out = []
    for i, c in enumerate(clips):
        c = dict(c, rank=i + 1, dup_of=None)
        for earlier in out:
            if earlier["dup_of"] is None and same_moment(earlier, c):
                c["dup_of"] = earlier["id"]
                break
        out.append(c)
    return out
