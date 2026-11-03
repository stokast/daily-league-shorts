import datetime as dt

import pytest

from rift import __main__ as cli
from rift import check, twitch


class Resp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


class Session:
    """Stands in for requests.Session: the token call answers `token_status`, GETs answer `pages` in order."""

    def __init__(self, pages, token_status=200):
        self.pages, self.token_status = list(pages), token_status
        self.posts, self.gets = [], []

    def post(self, url, data=None, timeout=None):
        self.posts.append((url, data))
        if self.token_status != 200:
            return Resp(self.token_status, {"message": "invalid client"})
        return Resp(200, {"access_token": f"tok{len(self.posts)}"})

    def get(self, url, params=None, headers=None, timeout=None):
        self.gets.append((url, dict(params), dict(headers)))
        return self.pages.pop(0)


def clip(i, views, b="b1", created="2026-11-02T10:00:00Z", video="v1", offset=None, dur=30, lang="en"):
    return {"id": f"c{i}", "view_count": views, "broadcaster_id": b, "broadcaster_name": b, "created_at": created,
            "video_id": video, "vod_offset": offset, "duration": dur, "language": lang, "title": f"t{i}",
            "url": f"https://clips.twitch.tv/c{i}"}


def test_credentials_come_from_the_environment_and_never_show_up_in_errors():
    with pytest.raises(twitch.TwitchError) as e:
        twitch.credentials({})
    assert "TWITCH_CLIENT_ID" in str(e.value)
    assert twitch.credentials({"TWITCH_CLIENT_ID": "id", "TWITCH_CLIENT_SECRET": "s3cret"}) == ("id", "s3cret")
    h = twitch.Helix("id", "s3cret", session=Session([], token_status=400))
    with pytest.raises(twitch.TwitchError) as e:
        h.token()
    assert "400" in str(e.value)
    assert "s3cret" not in str(e.value) and "s3cret" not in repr(h)


def test_top_clips_pages_through_the_window_and_sorts_by_views():
    s = Session([Resp(200, {"data": [clip(1, 50), clip(2, 900)], "pagination": {"cursor": "abc"}}),
                 Resp(200, {"data": [clip(3, 300), clip(2, 900)], "pagination": {}})])
    t0 = dt.datetime(2026, 11, 2, 7, tzinfo=dt.timezone.utc)
    got = twitch.Helix("id", "sec", session=s).top_clips("21779", t0, t0 + dt.timedelta(hours=24))
    assert [c["id"] for c in got] == ["c2", "c3", "c1"]
    assert len(s.posts) == 1
    first, second = s.gets[0][1], s.gets[1][1]
    assert (first["started_at"], first["ended_at"], first["first"]) == ("2026-11-02T07:00:00Z", "2026-11-03T07:00:00Z", 100)
    assert "after" not in first and second["after"] == "abc"
    assert s.gets[0][2] == {"Client-Id": "id", "Authorization": "Bearer tok1"}


def test_an_expired_token_is_renewed_once():
    s = Session([Resp(401, {"message": "Invalid OAuth token"}), Resp(200, {"data": [{"id": "21779"}]})])
    assert twitch.Helix("id", "sec", session=s).game_id() == "21779"
    assert len(s.posts) == 2 and s.gets[1][2]["Authorization"] == "Bearer tok2"


def test_clips_of_one_moment_are_duplicates_of_the_most_viewed():
    a = clip(1, 900, offset=1000, dur=30)
    b = clip(2, 500, offset=1020, dur=30)                      # overlaps a on the VOD
    c = clip(3, 400, offset=1100, dur=20)                      # same stream, a later moment
    d = clip(4, 300, b="b2")                                   # another streamer
    e = clip(5, 200, created="2026-11-02T10:01:30Z", video=None)  # no VOD to compare: made 90 s after a
    marked = twitch.mark_duplicates([a, b, c, d, e])
    assert [m["dup_of"] for m in marked] == [None, "c1", None, None, "c1"]
    assert [m["rank"] for m in marked] == [1, 2, 3, 4, 5]


def test_candidates_keep_one_clip_per_moment_in_the_wanted_language():
    clips = twitch.mark_duplicates([clip(1, 900, offset=0), clip(2, 800, b="b3", lang="ja"),
                                    clip(3, 700, offset=10), clip(4, 600, b="b2")])
    assert [c["id"] for c in cli.candidates(clips, "en", 5)] == ["c1", "c4"]
    assert [c["id"] for c in cli.candidates(clips, "", 5)] == ["c1", "c2", "c4"]
    assert [c["id"] for c in cli.candidates(clips, "en", 5, start=2)] == ["c4"]


def test_a_face_in_one_spot_through_the_clip_is_the_webcam():
    cam = (0.82, 0.2, 0.04, 0.1, 0.9)
    per_frame = [[cam], [cam, (0.3, 0.5, 0.03, 0.05, 0.8)], [cam], [], [cam], [cam], [(0.5, 0.5, 0.02, 0.03, 0.8)], [cam]]
    got = check.webcam(per_frame)
    assert got["cam"] and got["where"] == "top-right" and not got["fullscreen"] and got["share"] == 0.75


def test_faces_that_move_around_are_not_a_webcam_and_a_big_one_is_a_full_screen_cam():
    assert check.webcam([[(0.1 * i, 0.5, 0.03, 0.05, 0.9)] for i in range(8)]) == {"cam": False}
    assert check.webcam([]) == {"cam": False}
    assert check.webcam([[(0.35, 0.2, 0.3, 0.45, 0.95)]] * 6)["fullscreen"]


def test_music_verdict():
    w = lambda music, song: {"music": music, "song": song}  # noqa: E731
    assert check.music_verdict([w(0.1, 0.05)] * 4) == "none"
    assert check.music_verdict([w(0.2, 0.05), w(0.6, 0.45)]) == "song"
    assert check.music_verdict([w(0.7, 0.1), w(0.6, 0.1), w(0.2, 0.0)]) == "music"
    assert check.music_verdict([w(0.02, 0.0), w(0.35, 0.0), w(0.0, 0.0)]) == "music"  # a song in one window counts
    assert check.music_verdict([w(0.02, 0.01)] * 6) == "none"  # the real clips' level without music
    assert check.music_verdict([]) == "none"


def test_unpostable_words_are_found_in_the_transcript_or_the_title():
    assert check.unpostable("that was so clean", "WTF") == []
    assert check.unpostable("bro what", "nword? FYFP?") == ["nword"]
