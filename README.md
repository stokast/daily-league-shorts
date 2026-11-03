# Rift Daily

The best League of Legends clips, one a day, as vertical shorts for YouTube Shorts, TikTok and Instagram Reels.

- `brand/`: the identity (name, colours, fonts, the mark), every account text and the per-video templates in
  [`brand/BRAND.md`](brand/BRAND.md), and `make_brand.py`, which draws every asset in `brand/out/`.
- The brand kit page (the images to save, the texts to copy, the captions for each clip, the setup checklist):
  `brand/kit.html`, published at https://claude.ai/artifact/7igQ9Dhoo4xNDAX1SSHS8D.
- `rift/`: the clip finder (below). Each day's picks and skips, with the reasons, go in `runs/<date>.md`.
- Coming next: the rest of the pipeline. It adds r/leagueoflegends as a second source, detects each clip's layout (the
  streamer's webcam, the game), renders one short per clip in one fixed template (cam on top, game below, captions,
  the streamer's credit, the corner mark), checks it, and writes the title, description and captions ready to paste.
  Uploading stays manual.

Twitch API credentials come from the environment (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`), never from the repo.

## Finding clips

```bash
pip install -r requirements.txt
python -m rift top                       # the last 24 h of League clips, most viewed first, duplicates of one moment
                                         # marked -> work/runs/<UTC time>/clips.json
python -m rift check work/runs/<time>    # downloads the top English clips (one per moment) in view order and checks
                                         # each: --count 12, --start <rank>, --lang '' for any language
```

Each check writes `checks/<rank>_<clip>.json` and a contact sheet `.jpg` next to it: the video (size, fps, length),
the webcam (where, full screen, or none), music on stream (`song`, `music` or `none`, from AudioSet tags per 10 s),
the transcript and its language (Whisper), and words the channel can't post. Downloads land in `clips/`. Picking
from those signals is a judgment, written down in `CLAUDE.md` ("Choosing clips").
