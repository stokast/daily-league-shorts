# Rift Daily

The best League of Legends clips, one a day, as vertical shorts for YouTube Shorts, TikTok and Instagram Reels.

- `brand/`: the identity (name, colours, fonts, the mark), every account text and the per-video templates in
  [`brand/BRAND.md`](brand/BRAND.md), and `make_brand.py`, which draws every asset in `brand/out/`.
- The brand kit page (the images to save, the texts to copy, the captions for each clip, the setup checklist):
  `brand/kit.html`, published at https://claude.ai/artifact/7igQ9Dhoo4xNDAX1SSHS8D.
- Coming next: the pipeline. It finds each day's top League clips (Twitch's top clips by views, r/leagueoflegends),
  detects each clip's layout (the streamer's webcam, the game), renders one short per clip in one fixed template (cam
  on top, game below, captions, the streamer's credit, the corner mark), checks it, and writes the title, description
  and captions ready to paste. Uploading stays manual.

Twitch API credentials come from the environment (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`), never from the repo.
