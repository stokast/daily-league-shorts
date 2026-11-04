# Blip

A League of Legends clips channel on YouTube Shorts, TikTok and Instagram Reels: **Blip**, @bliplol. One clip per short,
the streamer credited on screen and in the text, uploaded by hand. How the name and the look were picked, round by
round, is at the end of this file.

Everything below is also on the brand kit page, with a Save button on each image, a Copy button on each text and the
per-video captions filled in from a title and a streamer: https://claude.ai/artifact/7igQ9Dhoo4xNDAX1SSHS8D (its
source is `brand/kit.html`).

## Identity

| | |
|---|---|
| Name | **Blip** |
| Handle (all three) | **@bliplol**: free on TikTok and YouTube (checked 2026-11-04). Instagram can't be checked from here: check it at sign-up, and if it's taken, the kit page's Instagram handle box changes every text that names it |
| Voice | a player talking to players: short, hyped when it's earned, never cringe; the clip is the star, its creator always credited |

**Colours**

| | Hex | Use |
|---|---|---|
| Night | `#0A0F1E` | backgrounds, the credit tag |
| Ping | `#18E6FF` | the primary: the i's dot and its rings, highlights, the credit tag's edge |
| Gold | `#F5C542` | the accent: CLIP on the credit tag, the spoken word in the captions |
| Mist | `#A0B2D2` | secondary text on navy |
| White | `#F4F7FF` | the name, text |

**Type** (all SIL Open Font License, in `brand/fonts/`): Urbanist Black for the name and CLIP; Chakra Petch Bold
Italic for the hook and the replay's steps, Chakra Petch Bold for labels (REPLAY); Inter ExtraBold / SemiBold for the
captions and the credit.

**The logo**: "blip" in lowercase Urbanist Black, white, its i dotted with a cyan ping, two rings spreading from it
the way a ping lands on the minimap. The ping alone is the mark, for small square spots. Drawn by
`brand/make_brand.py` (any size).

## Files (`brand/out/`)

| File | Where it goes |
|---|---|
| `blip-avatar-800.png` (`-400` for smaller uploads) | profile picture on YouTube, TikTok and Instagram (all crop it to a circle: the name sits inside it and still reads at 32 px) |
| `blip-avatar-ping-800.png` | the same with the ping instead of the name, for a symbol instead of a word |
| `blip-youtube-banner-2560x1440.png` | YouTube banner (Customisation > Branding); the name sits in the 1546 x 423 middle every device shows, the ping's rings spread from it over a faint map grid, other pings out on the map |
| `blip-youtube-watermark-150.png` | YouTube video watermark (Customisation > Branding > Video watermark, "Entire video") |
| `blip-mark-2048.png`, `-512.png` | the ping alone, transparent: wherever a square needs the brand (Discord, a website, a sticker) |
| `blip-wordmark.png` | the name alone, transparent, for dark backgrounds |
| `blip-wordmark-dark.png` | the name for light backgrounds (navy letters, a deeper cyan ping) |
| `blip-corner-bug.png` | the name on every short, left on the seam (the pipeline adds it) |
| `blip-credit-pill-sample.png` | how the streamer is credited on screen, right on the seam (the pipeline writes their channel in it) |

## Profiles

### YouTube
- **Channel name**: Blip · **Handle**: @bliplol
- **Description** (Customisation > Basic info):

> Outplays, pentakills, throws: the League of Legends moments you have to watch twice, picked from Twitch, Reddit and
> the community.
>
> Subscribe so you don't miss the next one.
>
> Every clip belongs to its creator and is credited in the video and in its description. Streamers: if you'd like a
> clip credited differently or taken down, email CONTACT_EMAIL and it's done within 24 hours.
>
> Blip isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially
> involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or
> registered trademarks of Riot Games, Inc.

- **Keywords** (Settings > Channel > Basic info): `league of legends, lol, league clips, lol clips, league of legends
  clips, lol highlights, league of legends highlights, league of legends funny moments, lol funny moments, outplays,
  pentakill, twitch clips, league shorts, lol shorts, blip, bliplol`
- **Links**: TikTok and Instagram (once made). **Contact email**: CONTACT_EMAIL.
- **Audience** (Settings > Channel > Advanced): "No, set this channel as not made for kids".
- **Upload defaults** (Settings > Upload defaults), so every upload starts filled in: the description below, the tags
  from the keywords, Category **Gaming**, language **English**, comments on.

### TikTok
- **Name**: Blip · **Username**: bliplol
- **Bio** (80 characters max): `League of Legends outplays, pentas & throws ⚡ Clips credited · DM for removal`
- **Photo**: the avatar. A personal account is enough (business accounts lose most of the sound library).
- **Each post**: comments, Duet and Stitch on; who can watch: everyone.

### Instagram
- **Name**: Blip · **Username**: bliplol
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

⚡ Subscribe to Blip for the next one.

All clips belong to their creators. Streamers: want this one credited differently or taken down? Email CONTACT_EMAIL and it's handled within 24h. Not endorsed by Riot Games.

#leagueoflegends #lol #shorts
```

**TikTok caption** (replace `TITLE` and `STREAMER`):
```
TITLE

🎥 twitch.tv/STREAMER
#leagueoflegends #lol #leagueclips #gaming #bliplol
```

**Instagram caption** (replace `TITLE` and `STREAMER`):
```
TITLE

🎥 twitch.tv/STREAMER
Follow @bliplol for the next one ⚡
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

## How the name and the look were picked

Round by round with the owner, from 2026-11-03 (each look round's boards come from `python3 brand/options.py <round>`):
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
- "need better names + handles for the clipping tiktok, not some robotic bs" (2026-11-04): names from League's and
  Twitch chat's own jokes instead of keywords. Free on TikTok and YouTube that day: It's Jungle's Fault
  (@itsjunglesfault), I Was In Chat (@iwasinchat), Throw Merchant (@throwmerchant), Penta Stolen (@pentastolen), Queue
  Pop (@queuepop), Rift Brainrot (@riftbrainrot), Inting Arc (@intingarc), Outplay Merchant (@outplaymerchant), Lowkey
  Challenger (@lowkeychallenger); free on TikTok only: Question Ping (@questionping), Smite Steal (@smitesteal), Gank
  Pls (@gankpls), Hardstuck Clips (@hardstuckclips). Taken on TikTok: Chat Clip That, Somebody Clip That, Who Clipped
  This, Chat Is This Real, Report Jungle, FF at 15, Riot Pls, Enemy Missing, Flash on F, Jungle Diff, Free Elo, Mute
  All, Rift Rats, Stuck in Silver, Bro Is Cooking.
- "stop thinknig of corny word plays with two worsd, just clean branding, easy to google, eg "Synapse" posts laegue
  shorts for years, sometihg like that, with no contest for seo" (2026-11-04): one coined word, the handle the word +
  "lol" (all 30 bare 4-6 letter coined words tried were taken on TikTok, and 16 of 18 longer ones). Free on TikTok and
  YouTube that day, nothing else ranking for the word on the web: Vireon (@vireonlol: only the vireo birds come up),
  Ravik (@raviklol: nothing exact), Vaelis (@vaelislol: fantasy wiki pages only), Orvane (@orvanelol: a French river
  spelled Orvanne), Veyra (@veyralol: a pending US trademark of The Celestial Group's). Free but Google turns them into
  a near twin: Teyra (the tayra, an animal), Ezryn (ezrin, a protein). Contested: Vantra (Hankook tyres, a camper-van
  maker), Corvin (Corvin Castle).
- "more" (2026-11-04): 32 more coined words; free with "lol" on TikTok and YouTube, nothing ranking for the word itself:
  Talyx (@talyxlol), Veynor (@veynorlol), Arveon (@arveonlol), Strevo (@strevolol), Kelvir (@kelvirlol), Torvan
  (@torvanlol), Venrix (@venrixlol), Solvyn (@solvynlol). Out: Vaxon (a biotech company), Lyrion (a music server), Kovex
  (small Czech firms), Nirox (Google turns it into NIOX, a pharma company); taken on TikTok even with "lol": Kyrel,
  Nyxen, Saelo, Ryvex.
- "why do they all look the asme lol, real varied options plz" (2026-11-04): other kinds of word, each free with "lol"
  on TikTok and YouTube and no game or channel of that name found: real words like Synapse, Kestrel (@kestrellol),
  Rigel (@rigellol), Basalt (@basaltlol: only a small indie game); short ones, Ibex (@ibexlol: a one-person indie
  studio), Ninth (@ninthlol), Blip (@bliplol: Blip.tv, shut in 2015). Out for a game or channel of the same name:
  Vellum, Marrow, Vigil, Halcyon, Quarry, Sable. Every name-style one was taken, even with "gg": Juno, Otto, Remy,
  Milo, Theo, Arlo, Oskar, Enzo, Nico, Ezra.
- "Blip, give me assets" (2026-11-04): the name is Blip, @bliplol. The look follows the name: a blip is a ping on
  the minimap, so the logo is "blip" in lowercase Urbanist Black with a cyan ping for the i's dot; the night navy,
  the cyan and the gold accent carry over from the League look. Drawn by `make_brand.py`; the shorts' tag and credit
  change with it.
