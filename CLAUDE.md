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
- The clip pipeline comes next (`README.md`).

## Rules
- Twitch credentials come from the environment only (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`). Never print, log or
  commit them, and never ask for them in chat.
- Every clip credits its streamer on screen and in every text. Skip clips with music playing on stream.
- Uploading stays with the owner: never post anything to YouTube, TikTok or Instagram.
- No clip media in git: sources, renders and downloads go to `work/`, `sources/`, `renders/` or `build/`. The brand
  images and fonts are the only binaries tracked.
- `BRAND.md` and the kit page say the same thing: a text change goes into both, an image change re-runs
  `make_brand.py`, and the page is republished.
