"""Blip's clip finder.

  python -m rift top [--hours 24]          the most viewed League clips of the last N hours, saved to a run folder
                                           (work/runs/<UTC time>/clips.json), duplicates of one moment marked
  python -m rift check RUN [--lang en]     download the run's top clips (one per moment) in view order and check
                   [--count 12]            each: contact sheet, webcam, music on stream, speech, unpostable words
  python -m rift short RECIPE [--draft]    render a short from shorts/<date>-<slug>.json into renders/
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
from pathlib import Path

from . import check, fetch, twitch


def show(clips: list[dict]) -> None:
    for c in clips:
        dup = "dup" if c.get("dup_of") else "   "
        print(f"{c['rank']:>4} {c['view_count']:>6} {c['broadcaster_name'][:18]:<18} {c['language']:<3} "
              f"{c['duration']:>4.0f}s {c['created_at'][5:16]} {dup} {c['title'][:60]}")


def cmd_top(a) -> Path:
    h = twitch.Helix(*twitch.credentials())
    gid = h.game_id(a.game)
    until = dt.datetime.now(dt.timezone.utc)
    since = until - dt.timedelta(hours=a.hours)
    clips = twitch.mark_duplicates(h.top_clips(gid, since, until, limit=a.limit))
    run = Path(a.out) / until.strftime("%Y-%m-%d_%H%M")
    run.mkdir(parents=True, exist_ok=True)
    (run / "clips.json").write_text(json.dumps({"game": a.game, "game_id": gid, "since": twitch.iso(since),
                                                "until": twitch.iso(until), "clips": clips}, indent=1,
                                               ensure_ascii=False))
    print(f"{len(clips)} clips -> {run}")
    show(clips[:a.show])
    return run


def candidates(clips: list[dict], lang: str | None, count: int, start: int = 1) -> list[dict]:
    """The most viewed clips from rank `start` on, one per moment, in `lang` (the stream's language) if given."""
    keep = [c for c in clips if not c.get("dup_of") and c["rank"] >= start and (not lang or c["language"] == lang)]
    return keep[:count]


def line(c: dict, r: dict) -> str:
    if "error" in r:
        return f"{c['rank']:>4} {c['broadcaster_name'][:16]:<16} ERROR {r['error'][:80]}"
    cam = r["cam"]
    cam_s = ("full cam" if cam.get("fullscreen") else f"cam {cam['where']}") if cam["cam"] else "no cam"
    song = max((w["song"] for w in r["audio"]), default=0)
    talk = r["speech"]
    flags = (" UNPOSTABLE:" + ",".join(r["unpostable"])) if r["unpostable"] else ""
    return (f"{c['rank']:>4} {c['view_count']:>6} {c['broadcaster_name'][:16]:<16} {r['probe']['duration']:>5.1f}s "
            f"{r['probe']['height']}p {cam_s:<18} music={r['music']}({song:.2f}) "
            f"{talk['language']}:{talk['words']}w{flags} | {talk['text'][:90]}")


def cmd_check(a) -> None:
    run = Path(a.run)
    clips = json.loads((run / "clips.json").read_text())["clips"]
    todo = candidates(clips, a.lang, a.count, a.start)

    def get(c):
        try:
            return fetch.download(c, run / "clips")
        except Exception as e:  # one clip failing doesn't stop the run
            return e

    with cf.ThreadPoolExecutor(4) as ex:
        paths = dict(zip([c["id"] for c in todo], ex.map(get, todo)))
    for c in todo:
        stem = run / "checks" / f"{c['rank']:04d}_{c['id']}"
        out = stem.with_suffix(".json")
        if out.exists():
            r = json.loads(out.read_text())
        else:
            p = paths[c["id"]]
            r = {"error": f"download failed: {p}"} if isinstance(p, Exception) else \
                check.check(c, p, stem.with_suffix(".jpg"))
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps({"clip": c, **r}, indent=1, ensure_ascii=False))
        print(line(c, r), flush=True)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="rift", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("top", help="the most viewed clips of the last N hours")
    t.add_argument("--hours", type=float, default=24)
    t.add_argument("--game", default=twitch.LEAGUE)
    t.add_argument("--limit", type=int, default=1000)
    t.add_argument("--show", type=int, default=40)
    t.add_argument("--out", default="work/runs")
    t.set_defaults(func=cmd_top)
    k = sub.add_parser("check", help="download and check a run's top clips")
    k.add_argument("run")
    k.add_argument("--lang", default="en", help="the stream language to keep ('' for any)")
    k.add_argument("--count", type=int, default=12)
    k.add_argument("--start", type=int, default=1, help="start from this rank")
    k.set_defaults(func=cmd_check)
    s = sub.add_parser("short", help="render a short from a recipe")
    s.add_argument("recipe")
    s.add_argument("--draft", action="store_true", help="a quick encode to look at")
    s.set_defaults(func=lambda a: __import__("rift.short", fromlist=["render"]).render(Path(a.recipe), a.draft))
    a = ap.parse_args(argv)
    a.func(a)


if __name__ == "__main__":
    main()
