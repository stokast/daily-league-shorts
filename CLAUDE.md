# CLAUDE.md

Rift Daily: a League of Legends clips channel on YouTube Shorts, TikTok and Instagram Reels. One clip per short, its
streamer credited on screen and in the text. The owner uploads every video by hand. This repo is separate from
league-shorts (the edits for Draco's and Huncho's channels): nothing here reads from it or changes it, and those
channels' notes don't apply here.

## Map
- `brand/BRAND.md`: name, colours, type, every account text and the per-video templates.
- `brand/make_brand.py`: draws every image in `brand/out/` (`python3 brand/make_brand.py`).
- `brand/kit.html`: the brand kit page, published at https://claude.ai/artifact/7igQ9Dhoo4xNDAX1SSHS8D. From another
  session, republish it with `url` set to that link, the PNGs of `brand/out/` as its `out/` files and the `downloads`
  capability.
- `rift/`: the clip finder (`python -m rift top`, then `check`; `README.md`): Twitch's most viewed League clips of the
  last 24 h, downloaded and checked (contact sheet, webcam, music, transcript, unpostable words). Tests in `tests/`
  (`python -m pytest -q tests`).
- `runs/<date>.md`: each day's picks and skips with the reason, so the next day's judgment starts from them.
- The rest of the pipeline (layout, template render, captions, credit, review page) comes next (`README.md`).

## Choosing clips
Walk the ranking, most viewed first, one clip per moment, and take each clip unless:
- the moment is in what's said and it isn't English. Trust Twitch's stream language: Whisper guesses short shouts
  wrong. Pure gameplay can come from any stream;
- nothing League happens and the talk isn't about League (an eviction story told in queue);
- it's too short to follow (about 8 s or less): look for another viewer's longer clip of the same moment;
- the check says `music` or `song`: look and listen first, and a song on stream is a skip;
- it has a slur, abuse read out, or a title saying a slur was heard (the check's `unpostable` list is a start, not
  the whole read);
- it's another streamer's stream shown inside this one, or an official esports broadcast (Riot claims those).
A clip with no webcam is fine. Write the picks and the skips, each with its reason, in `runs/<date>.md`.

Judge the play, not how big it looks: the vertical crop zooms in anyway (about 640 px of a 1080p stream fill the
phone's width). When the kill feed shows a kill the contact sheet doesn't explain, look closer (frames every half
second around it) before deciding. A pro's play on a streamer's spectate counts: the owner's favourite of the first
run was midbeast spectating T1 Peyz (Kalista spears stacked on the Gromp, a Q through it, Jax one-shot), which had been
skipped as "too small to read on a phone" (2026-11-03).

## Rules
- Twitch credentials come from the environment only (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`). Never print, log or
  commit them, and never ask for them in chat.
- Every clip credits its streamer on screen and in every text. Skip clips with music playing on stream.
- Uploading stays with the owner: never post anything to YouTube, TikTok or Instagram.
- No clip media in git: sources, renders and downloads go to `work/`, `sources/`, `renders/` or `build/`. The brand
  images and fonts are the only binaries tracked.
- `BRAND.md` and the kit page say the same thing: a text change goes into both, an image change re-runs
  `make_brand.py`, and the page is republished.
