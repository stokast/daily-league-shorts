"""Sound design and music for the Spawn ad, synthesized from the timeline (no samples).

python3 audio/make_audio.py [build/timeline.json] [build/audio.wav]

Everything lines up with the picture because it reads the same timeline the page draws from
(node tools/timeline-json.mjs). Music: 120 BPM in F major from the drop to the vortex.
"""
import json
import sys

import numpy as np
import pyloudnorm
from scipy import signal
from scipy.ndimage import minimum_filter1d

SR = 48000
TL = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'build/timeline.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'build/audio.wav'
DUR = TL['duration']
N = int(DUR * SR)
RNG = np.random.default_rng(7)


# ----------------------------------------------------------------------------------------- DSP
def tt(d):
    return np.arange(int(d * SR)) / SR


def db(x):
    return 10 ** (x / 20)


def midi(n):
    return 440.0 * 2 ** ((np.asarray(n, dtype=float) - 69) / 12)


def sos(kind, f, order=2):
    f = np.atleast_1d(f)
    f = np.clip(f, 10, SR / 2 * 0.95)
    return signal.butter(order, f if len(f) > 1 else f[0], btype=kind, fs=SR, output='sos')


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x, axis=-1)


def sweep(x, kind, f_of_t, block=128, order=2):
    """Time-varying Butterworth filter, coefficients updated per block (f_of_t: array per sample)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(f_of_t[min(i + block // 2, len(f_of_t) - 1)], 20, SR / 2 * 0.9))
        s = sos(kind, f, order)
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        y[i:i + block], zi = signal.sosfilt(s, x[i:i + block], zi=zi)
    return y


def phase_of(freq):
    freq = np.broadcast_to(freq, freq.shape if np.ndim(freq) else (1,))
    return np.cumsum(freq) / SR


def blep_saw(ph, dt):
    p = ph % 1.0
    y = 2 * p - 1
    m = p < dt
    t = p[m] / dt[m] if np.ndim(dt) else p[m] / dt
    y[m] -= t + t - t * t - 1
    m2 = p > 1 - (dt if not np.ndim(dt) else dt)
    t2 = (p[m2] - 1) / (dt[m2] if np.ndim(dt) else dt)
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def saw(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,)).copy()
    ph = np.cumsum(f) / SR + RNG.random()
    return blep_saw(ph, f / SR)


def pulse(freq, n, duty=0.5):
    f = np.broadcast_to(np.asarray(freq, float), (n,)).copy()
    ph = np.cumsum(f) / SR + RNG.random()
    dt = f / SR
    return 0.5 * (blep_saw(ph, dt) - blep_saw(ph + duty, dt))


def sine(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,)).copy()
    return np.sin(2 * np.pi * (np.cumsum(f) / SR) + ph0)


def tri(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,)).copy()
    p = (np.cumsum(f) / SR) % 1.0
    return 4 * np.abs(p - 0.5) - 1


def noise(n):
    return RNG.standard_normal(n)


def pink(n):
    w = noise(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 3.5


def env_exp(n, tau, attack=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def adsr(n, a, d, s, r, hold=None):
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel) ** 2


def pan2(x, p=0.0):
    a = (p + 1) * np.pi / 4
    return np.vstack([x * np.cos(a), x * np.sin(a)])


def reverb_ir(rt, seed, bright=6000, pre=0.012, width=1.0):
    r = np.random.default_rng(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.9 * t / rt)
    ir = []
    for ch in range(2):
        w = r.standard_normal(n)
        w = filt(w, 'low', bright)
        # darker tail
        w = w * (1 - 0.6 * (t / rt)) + filt(w, 'low', bright / 4) * 0.6 * (t / rt)
        ir.append(w * decay)
    ir = np.array(ir)
    ir[1] = ir[0] * (1 - width) + ir[1] * width
    p = int(pre * SR)
    ir = np.pad(ir, ((0, 0), (p, 0)))
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


IR_ROOM = reverb_ir(0.55, 1, 7000)
IR_HALL = reverb_ir(2.4, 2, 5500, pre=0.02)
IR_PLATE = reverb_ir(1.3, 3, 9000, pre=0.005)


def reverb(x, ir):
    if x.ndim == 1:
        x = pan2(x)
    out = np.vstack([signal.fftconvolve(x[0], ir[0]), signal.fftconvolve(x[1], ir[1])])
    return out


class Bus:
    def __init__(self, name):
        self.name = name
        self.x = np.zeros((2, N + SR * 4))

    def add(self, sig, at, gain_db=0.0, p=0.0):
        if sig.ndim == 1:
            sig = pan2(sig, p)
        i = int(round(at * SR))
        if i < 0:
            sig = sig[:, -i:]
            i = 0
        j = min(self.x.shape[1], i + sig.shape[1])
        self.x[:, i:j] += sig[:, : j - i] * db(gain_db)

    def out(self):
        return self.x[:, :N]


# ------------------------------------------------------------------------------- the keyboard
def key_click(kind='key', level=1.0, seed=0):
    r = np.random.default_rng(seed)
    d = 0.16
    n = int(d * SR)
    t = np.arange(n) / SR
    pitch = {'key': 1.0, 'space': 0.72, 'enter': 0.64, 'light': 1.12}[kind] * r.uniform(0.93, 1.07)
    trans = filt(r.standard_normal(n), 'high', 2600) * np.exp(-t / 0.0011)
    f = 245 * pitch * (1 + 0.35 * np.exp(-t / 0.004))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.016 if kind != 'space' else 0.026))
    case = filt(r.standard_normal(n), 'band', [900 * pitch, 2600 * pitch]) * np.exp(-t / 0.009)
    x = 0.85 * trans + 0.75 * body + 0.55 * case
    if kind in ('space', 'enter'):
        x += 0.35 * filt(r.standard_normal(n), 'band', [400, 1400]) * np.exp(-t / 0.02)
    # release click, softer
    rel = int(r.uniform(0.07, 0.1) * SR)
    rt = t[: n - rel]
    rl = filt(r.standard_normal(n - rel), 'high', 3200) * np.exp(-rt / 0.0008) * 0.35
    rl += np.sin(2 * np.pi * 330 * pitch * rt) * np.exp(-rt / 0.006) * 0.18
    x[rel:] += rl
    x *= level * r.uniform(0.82, 1.0)
    return pan2(x, r.uniform(-0.15, 0.15))


# --------------------------------------------------------------------------- drum machine
def kick(punch=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.03) + 40 * np.exp(-t / 0.006)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    x += filt(noise(n), 'high', 3000) * np.exp(-t / 0.0015) * 0.35 * punch
    x = np.tanh(x * 1.6) / np.tanh(1.6)
    return x


def clap():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) / (0.006 if k < 2 else 0.09))
    x = filt(noise(n), 'band', [900, 3800]) * e
    return x


def hat(open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    # metallic: a few square partials + noise
    m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in [3140, 4410, 5530, 6370, 7900])
    x = filt(m * 0.25 + noise(n), 'high', 6500) * np.exp(-t / (0.09 if open_ else 0.018))
    return filt(x, 'low', 12500)


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t * (1 + 0.2 * np.exp(-t / 0.01))) * np.exp(-t / 0.05)
    x = 0.6 * body + filt(noise(n), 'band', [1500, 8000]) * np.exp(-t / 0.08)
    return x


def crash(dur=2.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    m = sum(np.sin(2 * np.pi * f * t + RNG.random() * 6) for f in [3920, 5280, 6670, 7420, 8810, 10100])
    x = filt(filt(noise(n) + m * 0.15, 'high', 4200), 'low', 13000) * np.exp(-t / 0.65)
    x[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return x


# ----------------------------------------------------------------------------- synths
def supersaw(notes, dur, cutoff=3200, voices=7, detune=0.22):
    n = int(dur * SR)
    out = np.zeros((2, n))
    for note in notes:
        for v in range(voices):
            dv = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            s = saw(midi(note + dv), n)
            out += pan2(s, (v / (voices - 1)) * 1.6 - 0.8) / voices
    out = filt(out, 'low', cutoff)
    return out / max(1, len(notes)) * 1.6


def pluck(note, dur=0.25, kind='pulse', bright=4500, duty=0.25):
    n = int(dur * SR)
    f = midi(note)
    x = pulse(f, n, duty) if kind == 'pulse' else saw(f, n) if kind == 'saw' else tri(f, n)
    x = sweep(x, 'low', bright * np.exp(-np.arange(n) / SR / 0.06) + 400, block=64)
    return x * env_exp(n, dur / 3.5, 0.002)


def bass_note(note, dur):
    n = int(dur * SR)
    f = midi(note)
    x = saw(f, n) * 0.6 + pulse(f, n, 0.5) * 0.4 + sine(f / 2, n) * 0.5
    x = sweep(x, 'low', 280 + 900 * np.exp(-np.arange(n) / SR / 0.05), block=64)
    x = np.tanh(x * 1.8) / np.tanh(1.8)
    return x * adsr(n, 0.004, 0.08, 0.7, 0.03)


def bell(note, dur=1.6, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = np.zeros(n)
    for ratio, amp, tau in [(1, 1, 0.9), (2.0, 0.45, 0.5), (3.0, 0.25, 0.3), (4.16, 0.18 * bright, 0.18), (5.43, 0.1 * bright, 0.12)]:
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (tau * dur / 1.6))
    x *= np.minimum(1, t / 0.002)
    return x


# ------------------------------------------------------------------------- sound effects
def whoosh(dur, f0, f1, q=1.2, shape='rise', seed=0):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** u
    x = noise(n)
    lo = sweep(x, 'low', fc * (1 + 1 / q), block=128)
    x = sweep(lo, 'high', fc / (1 + 1 / q), block=128)
    if shape == 'rise':
        e = u ** 2.2
    elif shape == 'fall':
        e = (1 - u) ** 2
    else:
        e = np.sin(np.pi * u) ** 1.5
    return x * e


def riser(dur, notes=(53, 57, 60, 65), semis=12):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    out = np.zeros(n)
    for note in notes:
        f = midi(note) * 2 ** (semis * u ** 1.6 / 12)
        out += saw(f, n) * 0.5 + saw(f * 1.006, n) * 0.5
    out = sweep(out, 'low', 300 * (40 ** (u ** 1.5)), block=128)
    return out * (u ** 1.8) / len(notes)


def sub_boom(dur=1.2, f0=62, f1=31):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45) * np.minimum(1, t / 0.004)


def spawn_fx(root=77, big=True):
    """The 'materialize' sound every title screen makes: a pixel blip run, a sparkle and a thump."""
    d = 0.9
    n = int(d * SR)
    out = np.zeros((2, n))
    steps = [0, 7, 12, 19] if big else [0, 12]
    for k, st in enumerate(steps):
        i = int(k * 0.028 * SR)
        b = pluck(root + st, 0.22, 'pulse', 6000, 0.125) * 0.55
        b2 = pluck(root + st + 12, 0.18, 'tri') * 0.35
        b[: len(b2)] += b2
        out[:, i:i + len(b)] += pan2(b, (k - 1.5) * 0.25)
    t = np.arange(n) / SR
    sp = filt(filt(noise(n), 'high', 5500), 'low', 12000) * np.exp(-t / 0.12) * 0.3
    # sample-and-hold "bitcrush" sparkle
    sh = np.repeat(noise(n // 24 + 1), 24)[:n]
    sp += filt(sh, 'high', 3000) * np.exp(-t / 0.07) * 0.18
    out += pan2(sp, 0.0) + pan2(sp, 0.0) * 0.0
    thump = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.08)
    out += pan2(thump * (0.9 if big else 0.5))
    return out


def sting(kind):
    """Genre flavour on top of the spawn sound for the six full prompts."""
    if kind == 'fighter':  # a punch and a power stab
        n = int(0.7 * SR)
        t = np.arange(n) / SR
        hit = filt(noise(n), 'band', [300, 3000]) * np.exp(-t / 0.03) + np.sin(2 * np.pi * (90 + 120 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.09)
        stab = sum(saw(midi(nn), n) for nn in (53, 60, 65)) / 3
        stab = filt(np.tanh(stab * 2.5), 'low', 2400) * env_exp(n, 0.18, 0.003)
        return pan2(np.tanh(hit * 1.8) * 0.9 + stab * 0.5)
    if kind == 'shooter':  # a heavy crack and a metallic tail
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        crack = filt(noise(n), 'high', 900) * np.exp(-t / 0.012) * 1.2
        boom = sub_boom(1.2, 80, 38)[:n] * 0.9
        tail = filt(noise(n), 'band', [2000, 6000]) * np.exp(-t / 0.25) * 0.2
        cock = np.zeros(n)
        i = int(0.0 * SR)
        return pan2(np.tanh((crack + boom + tail + cock) * 1.5) * 0.8)
    if kind == 'traitor':  # sci-fi wobble, sus two-note motif
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        f = 900 * np.exp(-t / 0.25) + 300
        w = sine(f * (1 + 0.04 * np.sin(2 * np.pi * 14 * t)), n) * env_exp(n, 0.25)
        motif = np.zeros(n)
        for k, nn in enumerate([71, 72]):
            p = pluck(nn, 0.3, 'tri') * 0.8
            i = int((0.12 + k * 0.16) * SR)
            motif[i:i + len(p)] += p[: n - i]
        return pan2(w * 0.5 + motif * 0.6)
    if kind == 'dogboss':  # chiptune boss fanfare + a cartoon "boof"
        n = int(1.0 * SR)
        out = np.zeros(n)
        for k, nn in enumerate([69, 68, 67, 62]):
            p = pluck(nn, 0.16, 'pulse', 5000, 0.25) * 0.7
            i = int(k * 0.085 * SR)
            out[i:i + len(p)] += p[: n - i]
        tb = np.arange(int(0.16 * SR)) / SR
        boof = saw(520 * np.exp(-tb / 0.06) + 180, len(tb))
        boof = filt(filt(boof, 'band', [500, 1400]), 'low', 2500) * np.sin(np.pi * np.minimum(1, tb / 0.16)) ** 0.6
        i = int(0.42 * SR)
        out[i:i + len(boof)] += boof * 0.9
        return pan2(out)
    if kind == 'racing':  # engine rev
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        u = t / t[-1]
        f = 60 + 210 * (u ** 0.7) * (1 - 0.25 * np.maximum(0, u - 0.8) / 0.2)
        e = saw(f, n) + 0.5 * pulse(f * 2.01, n, 0.3)
        e = np.tanh(filt(e, 'low', 1800) * 3) * np.sin(np.pi * np.minimum(1, u * 1.1)) ** 0.5
        return pan2(e * 0.45, -0.1)
    if kind == 'zombie':  # school bell + a low dissonant hit
        n = int(1.4 * SR)
        t = np.arange(n) / SR
        ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(1300, 1), (2870, 0.5), (4120, 0.3)])
        ring *= (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 22 * t))) * np.exp(-t / 0.5)
        low = (saw(midi(37), n) + saw(midi(38), n)) * 0.5
        low = filt(low, 'low', 600) * env_exp(n, 0.5, 0.005)
        return pan2(ring * 0.25 + low * 0.45)
    return np.zeros((2, 1))


# ------------------------------------------------------------------------------- arrangement
BEAT = TL['beat']
W0 = TL['w0']
BAR = 4 * BEAT
music = Bus('music')
drums = Bus('drums')
keys = Bus('keys')
fx = Bus('fx')
verb_send = Bus('verb')

CHORDS = {  # bar index (1-based) -> (bass midi, pad notes, arp notes)
    1: (41, [53, 57, 60, 65, 69], [65, 69, 72, 77]),
    2: (36, [52, 55, 60, 64, 67], [64, 67, 72, 76]),
    3: (38, [53, 57, 62, 65, 69], [62, 65, 69, 74]),
    4: (34, [53, 58, 62, 65, 70], [62, 65, 70, 74]),
}
for b in (5, 6, 7, 8):
    CHORDS[b] = CHORDS[b - 4]
CHORDS[9] = (43, [53, 58, 62, 65, 67], [62, 65, 67, 70])  # Gm7 (then C7 on beat 3)
C7 = (36, [52, 55, 58, 60, 64], [64, 67, 70, 72])

vortex0 = TL['out']['vortex'][0]
flash_out = TL['out']['flash']
music_end = vortex0  # the arrangement stops here; the tape-stop takes the tail into the vortex

# kick-driven sidechain envelope for pads/bass
kick_times = [W0 + i * BEAT for i in range(0, 64) if W0 + i * BEAT < music_end]
side = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    L = int(0.32 * SR)
    seg = 1 - 0.75 * np.exp(-np.arange(L) / SR / 0.075) * (1 - np.exp(-np.arange(L) / SR / 0.004))
    side[i:i + L] = np.minimum(side[i:i + L], seg[: max(0, min(L, N - i))])

for k, kt in enumerate(kick_times):
    drums.add(kick(), kt, -8.0)
    bar = k // 4 + 1
    beat_in_bar = k % 4
    if beat_in_bar in (1, 3):
        drums.add(clap(), kt, -15.0, 0.05)
        verb_send.add(pan2(clap()), kt, -20.0)
    # hats: offbeat 8ths in bars 1-4, 16ths + open offbeats from bar 5
    off = kt + BEAT / 2
    if off < music_end:
        drums.add(hat(open_=bar >= 5), off, -24.0 if bar >= 5 else -23.0, 0.25)
    if bar >= 5:
        for s16 in (0.25, 0.75):
            ht = kt + BEAT * s16
            if ht < music_end:
                drums.add(hat(), ht, -30.0, -0.25)

# bass: pumping 8ths
for i in range(64):
    t0 = W0 + i * BEAT / 2
    if t0 >= music_end:
        break
    bar = int((t0 - W0) // BAR) + 1
    beat_pos = ((t0 - W0) % BAR) / BEAT
    chord = C7 if (bar == 9 and beat_pos >= 2) else CHORDS.get(bar, CHORDS[1])
    if i % 2 == 1 or bar >= 5:
        note = chord[0] + (12 if (i % 4 == 3 and bar >= 5) else 0)
        music.add(bass_note(note, BEAT / 2 * 0.92), t0, -8.0)

# pads: one chord per bar (bar 9 splits)
for bar in range(1, 10):
    t0 = W0 + (bar - 1) * BAR
    if t0 >= music_end:
        break
    if bar == 9:
        music.add(supersaw(CHORDS[9][1], BAR / 2, 2600), t0, -12.5)
        music.add(supersaw(C7[1], BAR / 2, 3200), t0 + BAR / 2, -12.5)
    else:
        cut = 2400 if bar <= 4 else 3600
        pad = supersaw(CHORDS[bar][1], BAR, cut)
        music.add(pad, t0, -12.0 if bar <= 4 else -11.0)

# arp: 16ths, chiptune pulse, brighter in the second half
for i in range(200):
    t0 = W0 + i * BEAT / 4
    if t0 >= music_end:
        break
    bar = int((t0 - W0) // BAR) + 1
    beat_pos = ((t0 - W0) % BAR) / BEAT
    chord = C7 if (bar == 9 and beat_pos >= 2) else CHORDS.get(bar, CHORDS[1])
    seq = chord[2] + [chord[2][2], chord[2][1]]
    note = seq[i % len(seq)] + (12 if bar >= 5 and i % 8 >= 4 else 0)
    p = pluck(note, 0.16, 'pulse', 3500 if bar <= 4 else 5500, 0.25)
    music.add(p, t0, -26.0 if bar <= 4 else -22.5, 0.35 if i % 2 else -0.35)

# bar 9: snare roll build into the vortex + noise riser
build0 = W0 + 8 * BAR
for k in range(32):
    st = build0 + k * BEAT / 4
    if k >= 16:
        st = build0 + 4 * BEAT / 4 * 4 + (k - 16) * BEAT / 8
    if st >= vortex0:
        break
    drums.add(snare(), st, -24 + k * 0.5, 0.0)
nr = whoosh(vortex0 - build0, 400, 9000, 0.8, 'rise')
music.add(nr, build0, -20.0)

# apply sidechain to the music bus (pads/bass/arp), then the tape-stop into the vortex
music.x[:, :N] *= side
drums_x = drums.x
mus = music.x + drums_x
# tape stop: from vortex0 the whole music slows to a halt over the vortex
i0, i1 = int(vortex0 * SR), int(flash_out * SR)
L = i1 - i0
rate = np.linspace(1, 0, L) ** 1.3
pos = i0 + np.cumsum(rate)
seg = np.vstack([np.interp(pos, np.arange(mus.shape[1]), mus[c]) for c in range(2)])
seg *= np.linspace(1, 0, L) ** 0.7
seg = np.vstack([sweep(seg[c], 'low', np.linspace(9000, 200, L) ** 1.0, block=128) for c in range(2)])
mus[:, i0:i1] = seg
mus[:, i1:] = 0
music_mix = mus

# ---------------------------------------------------------------------------- the keyboard
ev = TL['events']
key_seed = 100
for e in ev:
    if e['type'] == 'key':
        tag = e['tag']
        kind = 'space' if e['ch'] == ' ' else ('light' if tag == 'fast' else 'key')
        lvl = {'open': -10.0, 'end': -10.0, 'world': -14.0, 'fast': -18.0}[tag]
        keys.add(key_click(kind, 1.0, key_seed), e['t'] - 0.004, lvl)
        key_seed += 1
    elif e['type'] == 'enter':
        lvl = -7.0 if e['tag'] == 'open' else -14.0
        keys.add(key_click('enter', 1.0, key_seed), e['t'] - 0.004, lvl)
        key_seed += 1
        if e['tag'] != 'open':
            fx.add(whoosh(0.16, 1500, 7000, 1.5, 'swell'), e['t'], -24.0)

# ------------------------------------------------------------------------------- the trip in
OPEN_END = TL['open']['enter']
# a soft F major pad swelling under the typing (anticipation)
n = int((OPEN_END + 0.5) * SR)
swell = supersaw([53, 60, 65, 69], OPEN_END + 0.5, 1400, 5, 0.12)
u = np.linspace(0, 1, n)
swell *= (u ** 2.5) * (1 - np.clip((u - 0.92) / 0.08, 0, 1))
fx.add(swell, 0.0, -30.0)
room = filt(pink(int(TL['in']['suck'][1] * SR)), 'low', 900) * 0.02
fx.add(room, 0.0, -18.0)

# frame one: a soft monitor power-on (thump + a faint electric whine that settles into the room tone)
pw_n = int(0.9 * SR)
pw_t = np.arange(pw_n) / SR
power = np.sin(2 * np.pi * (48 + 40 * np.exp(-pw_t / 0.05)) * pw_t) * np.exp(-pw_t / 0.18)
power += filt(noise(pw_n), 'band', [2000, 7000]) * np.exp(-pw_t / 0.015) * 0.25
whine = np.sin(2 * np.pi * 15734 / 2 * pw_t) * np.exp(-pw_t / 0.3) * 0.015
fx.add(power + whine, 0.0, -16.0)

s0, s1 = TL['in']['suck']
suck = whoosh(s1 - s0 + 0.05, 300, 5000, 1.0, 'rise')
fx.add(suck, s0, -12.0)
zip_n = int((s1 - s0) * SR)
zu = np.linspace(0, 1, zip_n)
zipper = sine(220 * (8 ** (zu ** 2)), zip_n) * zu ** 2 * 0.6
fx.add(zipper, s0, -16.0)
pop_n = int(0.25 * SR)
pt = np.arange(pop_n) / SR
pop = np.sin(2 * np.pi * (900 + 1200 * np.exp(-pt / 0.01)) * pt) * np.exp(-pt / 0.04)
fx.add(pop, s1 - 0.01, -16.0)
verb_send.add(pan2(pop), s1 - 0.01, -18.0)

a0, a1 = TL['in']['approach']
fx.add(whoosh(a1 - a0 + 0.1, 120, 2500, 0.9, 'rise'), a0, -11.0)
fx.add(sub_boom(0.9, 50, 30), a1 - 0.05, -9.0)
hum_n = int((TL['in']['flash'] - a0) * SR)
hu = np.linspace(0, 1, hum_n)
hum = (saw(55, hum_n) * 0.5 + saw(110.3, hum_n) * 0.3)
hum = filt(hum, 'low', 900) * hu ** 1.5
fx.add(hum, a0, -22.0)

tu0, tu1 = TL['in']['tunnel']
rush = whoosh(tu1 - tu0, 500, 6000, 0.6, 'rise')
lfo = 0.65 + 0.35 * np.sin(2 * np.pi * 11 * np.arange(len(rush)) / SR)
fx.add(rush * lfo, tu0, -12.0)
# packets whizzing past
r = np.random.default_rng(3)
for k in range(14):
    wt = tu0 + (tu1 - tu0) * (k / 14) ** 0.8
    w = whoosh(0.18, 2000 + r.random() * 3000, 600, 2.5, 'swell')
    fx.add(w, wt, -22.0 + k * 0.5, r.uniform(-0.8, 0.8))
fx.add(riser(tu1 - a0, (53, 60, 65, 69), 12), a0, -14.0)
rev = crash(1.2)[::-1] * np.linspace(0, 1, int(1.2 * SR)) ** 3
fx.add(rev, TL['in']['flash'] - 1.2, -20.0)

# ------------------------------------------------------------------------------ the drop
DROP = TL['in']['flash']
fx.add(sub_boom(1.6, 64, 30), DROP, -3.0)
fx.add(kick(1.4), DROP, -4.0)
fx.add(crash(2.6), DROP, -12.0)
verb_send.add(pan2(crash(2.6)), DROP, -16.0)
for k, nn in enumerate([77, 81, 84, 89]):
    b = bell(nn, 1.8)
    fx.add(b, DROP + 0.02 + k * 0.045, -20.0, (k - 1.5) * 0.3)
    verb_send.add(pan2(b), DROP + 0.02 + k * 0.045, -22.0)

# ----------------------------------------------------------------------------- the spawns
MONT_NOTES = [72, 74, 77, 81, 86, 89, 93, 77, 82, 86, 89, 94, 89, 94, 98, 91]  # C | Dm run | Bb run | Gm
for e in ev:
    if e['type'] == 'spawn':
        if e['kind'] == 'montage':
            note = MONT_NOTES[e.get('index', 0) % len(MONT_NOTES)]
            fx.add(spawn_fx(note, big=False), e['t'] - 0.004, -15.0, 0.0)
            echo = pluck(note + 12, 0.2, 'pulse', 6000, 0.125)
            fx.add(echo, e['t'] + BEAT / 2 * 0.75, -27.0, 0.4)
            verb_send.add(pan2(pluck(note, 0.2, 'tri')), e['t'], -22.0)
        else:
            bar = int((e['t'] - W0) // BAR) + 1
            root = CHORDS.get(bar, CHORDS[1])[2][0]
            fx.add(spawn_fx(root, big=True), e['t'] - 0.004, -9.0)
            fx.add(sting(e['screen']), e['t'] + 0.01, -13.0)
            verb_send.add(spawn_fx(root, big=True), e['t'], -20.0)
    elif e['type'] == 'swap':
        tick_n = int(0.03 * SR)
        tk = filt(noise(tick_n), 'band', [2500, 6000]) * np.exp(-np.arange(tick_n) / SR / 0.004)
        fx.add(tk, e['t'], -26.0, 0.1)

# ------------------------------------------------------------------------- the walk
def footstep(seed):
    rr = np.random.default_rng(seed)
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * (70 + 50 * np.exp(-t / 0.015)) * t) * np.exp(-t / 0.045)
    grit = np.repeat(rr.standard_normal(n // 6 + 1), 6)[:n]
    crunch = filt(rr.standard_normal(n) * 0.6 + grit * 0.6, 'band', [1200, 5200]) * (np.exp(-t / 0.05) * (0.6 + 0.4 * rr.random(n) ** 3))
    return thud * 0.7 + crunch * 0.55


step_k = 1
while True:
    st = W0 + step_k * BEAT - 0.012
    if st >= vortex0 - 0.1:
        break
    fx.add(footstep(500 + step_k), st, -21.0 + (1.0 if step_k % 2 else 0.0), -0.18 if step_k % 2 else 0.18)
    step_k += 1

# dusk crickets, very low, across the walk
cr_n = int((vortex0 - W0) * SR)
ct = np.arange(cr_n) / SR
crick = np.zeros(cr_n)
for f0, rate, ph in [(4650, 7.0, 0.0), (5120, 5.3, 1.7), (4380, 6.1, 3.1)]:
    gate = (np.sin(2 * np.pi * 34 * ct + ph) > 0.2).astype(float) * (np.sin(2 * np.pi * rate / 4 * ct + ph) > 0.3)
    gate = filt(gate, 'low', 300)
    crick += np.sin(2 * np.pi * f0 * ct) * gate * 0.33
crick *= np.minimum(1, ct / 1.0) * np.clip((cr_n / SR - ct) / 0.6, 0, 1)
fx.add(pan2(crick, 0.3) * 0.6 + pan2(crick[::-1].copy(), -0.4) * 0.4, W0, -36.0)

# ----------------------------------------------------------------------------- the way out
CL = TL['climax']['enter']
fx.add(whoosh(flash_out - CL, 200, 6000, 0.7, 'rise'), CL, -10.0)
sw_n = int((flash_out - CL) * SR)
su = np.linspace(0, 1, sw_n)
swirl = whoosh(flash_out - CL, 800, 3000, 2.0, 'rise')
swirl_st = np.vstack([swirl * (0.5 + 0.5 * np.sin(2 * np.pi * (2 + 10 * su) * su)), swirl * (0.5 - 0.5 * np.sin(2 * np.pi * (2 + 10 * su) * su))])
fx.add(swirl_st, CL, -14.0)
fx.add(crash(1.0)[::-1] * np.linspace(0, 1, SR) ** 3, flash_out - 1.0, -18.0)
fx.add(sub_boom(1.4, 70, 28), flash_out, -4.0)
fx.add(kick(1.2), flash_out, -6.0)
o0, o1 = TL['out']['tunnel']
rush2 = whoosh(o1 - o0, 7000, 400, 0.6, 'fall')
lfo2 = 0.65 + 0.35 * np.sin(2 * np.pi * 9 * np.arange(len(rush2)) / SR)
fx.add(rush2 * lfo2, o0, -12.0)
fall = riser(o1 - o0, (53, 60, 65, 69), -12)[::-1] * 0.0
for k in range(10):
    wt = o0 + (o1 - o0) * (k / 10)
    fx.add(whoosh(0.2, 600 + r.random() * 1500, 4000, 2.5, 'swell'), wt, -21.0 - k, r.uniform(-0.8, 0.8))
rc0, rc1 = TL['out']['recede']
zip_n = int((rc1 - rc0) * SR)
zu = np.linspace(0, 1, zip_n)
fx.add(sine(1800 * (0.12 ** (zu ** 0.7)), zip_n) * (1 - zu) ** 1.5 * 0.5, rc0, -18.0)
fx.add(whoosh(rc1 - rc0, 3000, 200, 1.0, 'fall'), rc0, -14.0)
blip_n = int(0.12 * SR)
bt_ = np.arange(blip_n) / SR
fx.add(np.sin(2 * np.pi * 1320 * bt_) * np.exp(-bt_ / 0.03), rc1, -22.0)

# ------------------------------------------------------------------------------- end card
SPARK = TL['end']['sparkle']
URL = TL['end']['url']
room2 = filt(pink(int((DUR - rc1) * SR)), 'low', 800) * 0.02
fx.add(room2 * np.linspace(0, 1, len(room2)) ** 0.5, rc1, -20.0)
# resolution: F add9 pad swell + celesta sparkle on the sparkle; a soft chime for spawn.co
pad_n = int((DUR - SPARK + 0.2) * SR)
end_pad = supersaw([53, 60, 65, 67, 69, 72], DUR - SPARK + 0.2, 2200, 7, 0.18)
pu = np.arange(pad_n) / SR
end_pad *= np.minimum(1, pu / 0.25) * np.clip((DUR - SPARK - pu) / 1.2, 0, 1)
fx.add(end_pad, SPARK - 0.05, -24.0)
verb_send.add(end_pad, SPARK - 0.05, -28.0)
fx.add(sub_boom(2.0, 44, 40), SPARK, -18.0)
for k, nn in enumerate([89, 93, 96, 101, 100]):
    b = bell(nn, 2.4, 0.8)
    fx.add(b, SPARK + k * 0.06, -24.0, (k - 2) * 0.25)
    verb_send.add(pan2(b), SPARK + k * 0.06, -27.0)
for k, nn in enumerate([84, 89]):
    b = bell(nn, 1.8, 0.6)
    fx.add(b, URL + k * 0.09, -24.0, 0.15)
    verb_send.add(pan2(b), URL + k * 0.09, -22.0)

# ------------------------------------------------------------------------------- mixdown
key_room = reverb(keys.x[:, :N + SR], IR_ROOM)[:, : N + SR]
wet = reverb(verb_send.x[:, :N + SR], IR_HALL)[:, : N + SR]
music_wet = reverb(music_mix[:, :N + SR] * 0.25, IR_PLATE)[:, : N + SR]

mix = np.zeros((2, N + SR))
mix += music_mix[:, : N + SR]
mix += music_wet * 0.35
mix += keys.x[:, : N + SR] + key_room * 0.18
mix += fx.x[:, : N + SR]
mix += wet * 0.5
mix = mix[:, :N]
mix = filt(mix, 'high', 28)

# gentle bus glue: soft-knee compression on the sum
env = np.sqrt(np.maximum(filt(np.mean(mix ** 2, axis=0), 'low', 8), 0))
env = np.maximum(env, 1e-6)
thr = db(-18)
gain = np.where(env > thr, (env / thr) ** (1 / 2.0 - 1), 1.0)
mix *= gain

# loudness to -14 LUFS, then a lookahead limiter for -1 dBTP
meter = pyloudnorm.Meter(SR)
lufs = meter.integrated_loudness(mix.T)
mix *= db(-14.0 - lufs)


def limiter(x, ceiling_db=-1.8, look=0.004, release=0.08):
    ceil = db(ceiling_db)
    peak = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    w = int(look * SR)
    g = minimum_filter1d(need, size=2 * w + 1, mode='nearest')
    a = np.exp(-1 / (release * SR))
    g = signal.lfilter([1 - a], [1, -a], g - 1) + 1
    g = np.minimum(g, minimum_filter1d(need, size=2 * w + 1, mode='nearest'))
    return x * g


for _ in range(3):
    mix = limiter(mix)
    lufs = meter.integrated_loudness(mix.T)
    mix *= db(-14.0 - lufs)
mix = limiter(mix)
tp = 20 * np.log10(np.max(np.abs(signal.resample_poly(mix, 4, 1, axis=1))) + 1e-12)
lufs = meter.integrated_loudness(mix.T)
fade = int(0.05 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)

import wave

pcm = np.clip(mix.T, -1, 1)
pcm24 = (pcm * (2 ** 23 - 1)).astype(np.int32)
raw = np.zeros((pcm24.shape[0], 2, 3), dtype=np.uint8)
for c in range(2):
    v = pcm24[:, c].astype(np.int64) & 0xFFFFFF
    raw[:, c, 0] = v & 0xFF
    raw[:, c, 1] = (v >> 8) & 0xFF
    raw[:, c, 2] = (v >> 16) & 0xFF
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(3)
    w.setframerate(SR)
    w.writeframes(raw.tobytes())

print(f'wrote {OUT}: {DUR:.2f}s, integrated {lufs:.1f} LUFS, true peak {tp:.2f} dBTP')
if '--stems' in sys.argv:
    # per-bus loudness by section (pre-master levels, relative), to judge the balance
    buses = {'music(pads/bass/arp)': music.x[:, :N] , 'drums': drums.x[:, :N], 'keys': keys.x[:, :N], 'fx': fx.x[:, :N], 'verb': wet[:, :N] * 0.5}
    for name, a, b in [('world', DROP + 0.5, vortex0), ('trip out', flash_out, rc1), ('end', rc1, DUR)]:
        line = []
        for bn, bx in buses.items():
            seg = bx[:, int(a * SR):int(b * SR)]
            l = meter.integrated_loudness(seg.T) if np.max(np.abs(seg)) > 1e-6 else -99
            line.append(f'{bn} {l:6.1f}')
        print(f'  [{name}] ' + ' | '.join(line))
    # music bus split: arp only

# short-term loudness by section, to check the balance
for name, a, b in [('opening', 0, TL['open']['enter']), ('suck+tunnel', TL['open']['enter'], DROP), ('world', DROP, vortex0),
                   ('vortex+out', vortex0, rc1), ('end card', rc1, DUR)]:
    seg = mix[:, int(a * SR):int(b * SR)]
    if seg.shape[1] > SR * 0.5:
        print(f'  {name:12s} {meter.integrated_loudness(seg.T):6.1f} LUFS   peak {20 * np.log10(np.max(np.abs(seg)) + 1e-9):6.1f} dBFS')
