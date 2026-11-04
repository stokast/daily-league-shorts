import re

from rift import post, short


def words(*items):
    return [{"w": w, "start": s, "end": e, "p": 0.9} for w, s, e in items]


def test_a_crop_keeps_its_height_and_centre_and_takes_the_panels_shape():
    assert short.fit_crop([589, 10, 622, 760], 1080 / 1320) == (589, 10, 622, 760)
    x, y, w, h = short.fit_crop([500, 50, 900, 745], 0.8)
    assert (y, h, w) == (50, 745, 596) and abs((x + w / 2) - 950) <= 1
    assert short.fit_crop([1700, 0, 400, 1000], 0.8)[0] == 1920 - 800  # kept inside the frame


def test_captions_are_upper_case_with_swears_starred_and_full_stops_dropped():
    assert short.caption_text("fuck,") == "F**K"
    assert short.caption_text("Fucking") == "F**KING"
    assert short.caption_text("that?") == "THAT?"
    assert short.caption_text("Brohan.") == "BROHAN"
    assert short.caption_text("I'll") == "I'LL"


def test_words_group_into_short_captions_split_at_pauses_and_questions():
    ws = words(("What", 6.92, 7.30), ("the", 7.52, 7.70), ("fuck,", 7.78, 8.10), ("what", 8.32, 8.45),
               ("was", 10.36, 10.5), ("that?", 10.6, 10.9), ("Nice", 10.95, 11.0), ("after", 12.0, 12.2))
    chunks = short.chunk_words(ws, 1.2, 11.05)  # the trim starts 1.2 s in: pauses are measured in one time base
    texts = [" ".join(w["text"] for w in c["words"]) for c in chunks]
    # three words at most, a 1.9 s pause splits, a question ends its line, "after" is past the trim
    assert texts == ["WHAT THE F**K", "WHAT", "WAS THAT?", "NICE"]
    assert abs(chunks[0]["start"] - 5.72) < 1e-6  # relative to the trim's start
    assert all(a["end"] <= b["start"] for a, b in zip(chunks, chunks[1:]))  # never overlaps the next caption


def test_long_lines_split_at_the_letter_limit():
    ws = words(("Sorry,", 0.0, 0.2), ("I'll", 0.2, 0.3), ("let", 0.3, 0.4), ("you", 0.4, 0.5), ("focus.", 0.5, 0.8))
    texts = [" ".join(w["text"] for w in c["words"]) for c in short.chunk_words(ws, 0, 5)]
    assert texts == ["SORRY I'LL LET", "YOU FOCUS"]
    ws += words(("I'm", 0.9, 1.0), ("going", 1.0, 1.1))
    texts = [" ".join(w["text"] for w in c["words"]) for c in short.chunk_words(ws, 0, 5)]
    assert texts == ["SORRY I'LL LET", "YOU FOCUS", "I'M GOING"]  # a full stop ends the line


def evaluate(expr: str, t: float) -> float:
    py = expr.replace("clip(", "_clip(")
    return eval(py, {"_clip": lambda v, lo, hi: max(lo, min(hi, v)), "min": min, "t": t})


def test_section_gains_lift_their_stretch_with_short_ramps():
    expr = short.gain_expr([[1.0, 6.85, 16]])
    assert abs(evaluate(expr, 3.0) - 10 ** (16 / 20)) < 1e-3
    assert evaluate(expr, 0.5) == 1 and evaluate(expr, 7.0) == 1
    assert 1 < evaluate(expr, 1.03) < 10 ** (16 / 20)  # inside the 60 ms ramp
    both = short.gain_expr([[0, 2, 12], [2.5, 3, -6]])
    assert abs(evaluate(both, 2.75) - 10 ** (-6 / 20)) < 1e-3
    assert re.fullmatch(r"[\d.()+*/,\-\w ]+", both)  # nothing an ffmpeg expression can't read


def test_the_timeline_adds_the_slowed_replay_to_the_clip():
    r = {"trim": [1.2, 11.05], "replay": {"from": 4.3, "to": 6.1, "speed": 0.35}}
    tl = short.timeline(r, 60.0)
    assert tl["main_n"] == 591 and tl["rep_n"] == 309
    assert abs(tl["total_s"] - (591 + 309) / 60) < 1e-9
    assert short.timeline({"trim": [0, 10]}, 30.0)["rep_n"] == 0


def test_layers_show_the_hook_first_and_the_replay_steps_in_order():
    r = {"trim": [1.2, 11.05], "cam": [1340, 798, 310, 282], "hook": ["PEYZ ONE-SHOTS JAX", "THROUGH A GROMP"],
         "hook_until": 2.8, "clip": {"credit": "twitch.tv/midbeast"},
         "replay": {"from": 4.3, "to": 6.1, "speed": 0.35, "steps": [[4.3, "ONE"], [4.85, "TWO"], [5.2, "THREE"]]}}
    tl = short.timeline(r, 60.0)
    lays = short.layers(r, tl)
    hook = [l for l in lays if l.t1 == 2.8]
    assert len(hook) == 1 and hook[0].y > short.SEAM  # under the seam, on the play
    steps = sorted((l for l in lays if l.y == short.STEPS_Y), key=lambda l: l.t0)
    assert [round(s.t0 - tl["main_s"], 2) for s in steps] == [0.0, 1.57, 2.57]
    assert all(a.t1 <= b.t0 + 1e-9 for a, b in zip(steps, steps[1:]))


def test_post_texts_fill_the_title_and_the_streamer_and_keep_the_email_placeholder(monkeypatch):
    monkeypatch.delenv("RIFT_CONTACT_EMAIL", raising=False)
    t = post.texts("Peyz One-Shots Jax Through a Gromp 🤯", "twitch.tv/midbeast")
    assert t["YouTube title"] == "Peyz One-Shots Jax Through a Gromp 🤯"
    assert "🎥 Clip: twitch.tv/midbeast (go follow!)" in t["YouTube description"]
    assert "Email CONTACT_EMAIL" in t["YouTube description"]
    assert t["TikTok caption"].startswith("Peyz One-Shots Jax") and "#bliplol" in t["TikTok caption"] and "@bliplol" in t["Instagram caption"]
    monkeypatch.setenv("RIFT_CONTACT_EMAIL", "clips@example.com")
    assert "Email clips@example.com" in post.texts("x", "twitch.tv/y")["YouTube description"]


def test_post_texts_carry_no_tagline():
    # the owner, 2026-11-03: "remove all "league clips" "every day" "leagues clips" etc"
    for v in post.texts("x", "twitch.tv/y").values():
        low = v.lower()
        assert "every day" not in low and "best clip" not in low and "tomorrow" not in low


def test_the_seam_line_stops_short_of_the_name_and_the_credit_and_draws_itself_in_at_the_start():
    from brand import make_brand as brand
    import numpy as np
    r = {"cam": [0, 0, 300, 300], "clip": {"credit": "twitch.tv/someone"}, "trim": [0.0, 5.0]}
    lays = short.layers(r, {"main_s": 5.0, "rep_s": 0.0})
    line = next(lay for lay in lays if isinstance(lay, short.SeamLine))
    _, tag_at = brand.corner_bug(62, info=True)
    assert line.x0 > 26 + tag_at["letters"][2]                       # nothing under the letters
    pill = next(lay for lay in lays if isinstance(lay, short.Layer) and lay.slide != (0, 0))
    body = np.nonzero(pill.img[..., 3].max(axis=0) > 0.75)[0]
    assert line.x0 + line.img.shape[1] < pill.x + body[0]            # nor under the credit
    mid = line.x0 + line.img.shape[1] // 2
    seam = []
    for t in (0.0, 2.0):
        frame = np.zeros((short.H, short.W, 3), np.uint8)
        line.draw(frame, t)
        seam.append(int(frame[line.y:line.y + 4, mid].max()))
    assert seam[0] == 0 and seam[1] > 100                            # not there at the start, there after the intro
