# Rift Daily

A League of Legends channel on YouTube Shorts, TikTok and Instagram Reels. One clip per short, the streamer credited
on screen and in the text, uploaded by hand.

The look and the name are being picked with the owner, round by round (2026-11-03; each round's boards come from
`python3 brand/options.py <round>`):
- "give me other logo/rest of the design options, dont like those": A Sticker, B Broadcast, C Arcade, D Street (`1`).
- "i like B the most, but want more options, maybe 2-3 like B + 2-3 more": B2 Night Game, B3 Championship, B4
  Daylight, E Chrome, F Mono, G Esports (`2`).
- "improve b3s logo, also the "clip" and "twitch.tv/mrbeat" arent verticaly aligned": three B3 logos in polished gold
  (`b3`); the seam's words share one baseline.
- "remove all "league clips" "every day" "leagues clips" etc": no image or text carries a tagline; only the hidden
  search keywords and the hashtags still say league clips.
- "also give other options than rift daily": @riftdaily is taken on YouTube and TikTok; six names in the B3 look
  (`names`).
- "make lgoo more league themed, andthose names dont sound like a league clip channel at all": the League look
  (`league`): navy, Hextech gold, a glowing blue crystal and Cinzel, with three logos (winged crest, hextech crystal,
  summoner ring); and eight names that say League (`lnames`), each handle free on YouTube and TikTok that day: SoloQ
  Madness, League Madness, Challenger Plays, LoL Outplays HQ, SoloQ Chaos, Summoner Moments, League Insanity, LoL
  Highlights HQ.

This file changes to the name and look picked.

Everything below is also on the brand kit page, with a Save button on each image, a Copy button on each text and the
per-video captions filled in from a title and a streamer: https://claude.ai/artifact/7igQ9Dhoo4xNDAX1SSHS8D (its
source is `brand/kit.html`).

## Identity

| | |
|---|---|
| Name | **Rift Daily** |
| Handle (all three) | **@riftdaily**: taken on YouTube and TikTok (checked 2026-11-03), so the name is being picked again |
| Voice | a player talking to players: short, hyped when it's earned, never cringe; the clip is the star, its creator always credited |

**Colours**

| | Hex | Use |
|---|---|---|
| Rift Night | `#0A0F1E` | backgrounds, the credit tag |
| Rift Cyan | `#18E6FF` | the primary: "DAILY", highlights, the tag's edge |
| Hextech Gold | `#F5C542` | the accent: "CLIP" |
| Mist | `#A0B2D2` | secondary text on navy |
| White | `#F4F7FF` | text |

**Type** (all SIL Open Font License, in `brand/fonts/`): Chakra Petch Bold Italic for the name and titles, Chakra
Petch SemiBold for labels, Inter ExtraBold / SemiBold for captions and the credit.

**The mark**: a hextech hexagon split by a glowing rift crack, cyan on one side and gold on the other, a play button in
the middle: clips, from the Rift. Drawn by `brand/make_brand.py` (any size).

## Files (`brand/out/`)

| File | Where it goes |
|---|---|
| `rift-daily-avatar-800.png` | profile picture on YouTube, TikTok and Instagram (all crop it to a circle: the mark sits inside it) |
| `rift-daily-youtube-banner-2560x1440.png` | YouTube banner (Customisation > Branding); the mark and the name sit in the 1546 x 423 middle every device shows |
| `rift-daily-youtube-watermark-150.png` | YouTube video watermark (Customisation > Branding > Video watermark, "Entire video") |
| `rift-daily-mark-2048.png`, `-512.png` | the mark alone, transparent: anywhere else (Discord, a website, a sticker) |
| `rift-daily-wordmark.png` | the name alone, transparent |
| `rift-daily-corner-bug.png` | the small brand mark at the top of every short (the pipeline adds it) |
| `rift-daily-credit-pill-sample.png` | how the streamer is credited on screen (the pipeline writes their channel in it) |

## Profiles

### YouTube
- **Channel name**: Rift Daily · **Handle**: @riftdaily
- **Description** (Customisation > Basic info):

> Outplays, pentakills, throws: the League of Legends moments you have to watch twice, picked from Twitch, Reddit and
> the community.
>
> Subscribe so you don't miss the next one.
>
> Every clip belongs to its creator and is credited in the video and in its description. Streamers: if you'd like a
> clip credited differently or taken down, email CONTACT_EMAIL and it's done within 24 hours.
>
> Rift Daily isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially
> involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or
> registered trademarks of Riot Games, Inc.

- **Keywords** (Settings > Channel > Basic info): `league of legends, lol, league clips, lol clips, league of legends
  clips, lol highlights, league of legends highlights, league of legends funny moments, lol funny moments, outplays,
  pentakill, twitch clips, league shorts, lol shorts, rift daily`
- **Links**: TikTok and Instagram (once made). **Contact email**: CONTACT_EMAIL.
- **Audience** (Settings > Channel > Advanced): "No, set this channel as not made for kids".
- **Upload defaults** (Settings > Upload defaults), so every upload starts filled in: the description below, the tags
  from the keywords, Category **Gaming**, language **English**, comments on.

### TikTok
- **Name**: Rift Daily · **Username**: riftdaily
- **Bio** (80 characters max): `League of Legends outplays, pentas & throws ⚡ Clips credited · DM for removal`
- **Photo**: the avatar. A personal account is enough (business accounts lose most of the sound library).
- **Each post**: comments, Duet and Stitch on; who can watch: everyone.

### Instagram
- **Name**: Rift Daily · **Username**: riftdaily
- **Bio** (150 characters max):
  ```
  League of Legends outplays, pentas & throws ⚡
  Straight from Twitch, every clip credited
  DM for credit or removal
  ```
- **Account**: Professional > Creator, category "Gaming video creator". **Link**: the YouTube channel.
- **Each reel**: "Also share to feed" on; topics League of Legends, Gaming, Esports.

## Every video

Only two things change per clip: the **title** and the **streamer's channel**. The pipeline writes both into a
ready-to-paste text file next to each render.

**Title** (YouTube title, and the first line on TikTok and Instagram): what happens, in under 40 characters, Title
Case, the player's name when they're known, then one emoji that fits the moment, or none (😭 a fail, 💀 a brutal one,
🤯 an impossible play, 🐐 a masterclass). Never a promise the clip doesn't keep.

**YouTube description** (save it as the upload default; per video, replace `STREAMER`):
```
🎥 Clip: twitch.tv/STREAMER (go follow!)

⚡ Subscribe to Rift Daily for the next one.

All clips belong to their creators. Streamers: want this one credited differently or taken down? Email CONTACT_EMAIL and it's handled within 24h. Not endorsed by Riot Games.

#leagueoflegends #lol #shorts
```

**TikTok caption** (replace `TITLE` and `STREAMER`):
```
TITLE

🎥 twitch.tv/STREAMER
#leagueoflegends #lol #leagueclips #gaming #riftdaily
```

**Instagram caption** (replace `TITLE` and `STREAMER`):
```
TITLE

🎥 twitch.tv/STREAMER
Follow @riftdaily for the next one ⚡
#leagueoflegends #lol #leagueclips #gaming #esports
```

`CONTACT_EMAIL` is set once (in the upload default and the channel description), never per video.

## Posting
- Post at the same hour each time; the same file on all three, uploaded natively (never a TikTok download with its
  watermark onto Reels or Shorts).
- A good slot to start: 6 pm US Eastern (midnight in central Europe), when both NA and EU players are online. Move it
  once the analytics show when your viewers watch.

## Credit and rights
- Every clip credits its streamer on screen and in the text, every time.
- Clips with music playing on stream are skipped (Content ID claims them, TikTok mutes them).
- Bigger streamers: one message asking if they're fine with their clips on the channel, credited; most say yes.
- A takedown request is done within 24 hours, no argument.
- YouTube can refuse monetization for "reused content" (other people's videos without much added). The captions, the
  hook and the credit help; they don't guarantee it.

## Setup checklist
1. A brand email for all three accounts and for CONTACT_EMAIL (e.g. a new Gmail).
2. YouTube: a channel as a Brand Account (others can help manage it later), handle, avatar, banner, watermark,
   description, keywords, contact email, not made for kids, upload defaults, phone verification.
3. TikTok: account, username, name, bio, avatar.
4. Instagram: account, switch to Professional > Creator, name, username, bio, avatar, link.
5. Link them to each other: YouTube's links to TikTok and Instagram, the YouTube channel in the Instagram and TikTok
   bios (TikTok shows a bio link from 1,000 followers).
