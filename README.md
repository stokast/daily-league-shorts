# Blip

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

## Making a short

```bash
python -m rift short shorts/<date>-<slug>.json [--draft]   # -> renders/<slug>.mp4 and renders/<slug>.txt
```

One JSON recipe per short, in `shorts/` with its word times (`<slug>.words.json`, Whisper large-v3-turbo, English):

| Key | What it sets |
|---|---|
| `clip` | id, url, streamer, `credit` (twitch.tv/<channel>, on screen and in every text), Twitch title, views |
| `source`, `trim` | the downloaded clip and the stretch used, in its seconds |
| `cam`, `game` | the streamer's cam box in the stream (`null`: no cam) and the play's crop (fitted to the panel around its centre) |
| `hook`, `hook_until` | two lines over the play for the first seconds |
| `words` | the word times for the captions |
| `gains`, `pre_limit_db`, `sfx` | `[from, to, dB]` stretches (quiet game up, clipped shouts down), a fast limiter on the lifted game's hits, `[time, sound, dB]` sounds on the play |
| `replay` | `from`, `to`, `speed`, a tighter `game` crop, `steps` `[[time, text]]`, `impact_at`, `riser_db` |
| `post` | the title; the descriptions and captions come from `brand/BRAND.md`'s templates (`rift/post.py`) |

The format: 1080 x 1920; the cam on top (600 px, over a blurred copy where it's narrower), the play below; on the
seam the Blip tag and the credit pill; captions in the cam's lower part (up to three words, the spoken one in
gold, swears starred in the text only); an optional slowed replay with numbered steps in the lower third. Sound: one
static gain to -14 LUFS and a limiter that takes at most 4 dB (a clip with clipped shouts ends a little quieter).

Sounds live in `assets/sfx/` (never committed), copied from the editor's UR.FASTEDITOR pack: `whoosh.ogg` = "336
SFX/MIX/Swoosh 2.wav", `impact.ogg` = "336 SFX/HITS/Hit.wav", `riser.ogg` = "336 SFX/MIX/QUICK RISER (7).wav".
