"""Offline port of the app's mock brain (src/lib/brain.ts) + palette.

Kept bit-for-bit compatible with the TypeScript so pins land in the same place
and participants get the same colors as the running app. When the real backend
exists, this is the file you'd swap for Voyage embeddings + a fitted projection.
"""
from __future__ import annotations
import math

EMBED_DIM = 64
LINK_THRESHOLD = 0.64  # matches TUNING.linkThreshold (tuned for this mock embedder)

# --- 12 pop palette (matches src/config/palette.ts) -------------------------
POP_PALETTE = [
    {"name": "Ember",     "hex": "#F0392B"},
    {"name": "Coral",     "hex": "#FF6B4A"},
    {"name": "Tangerine", "hex": "#FF9F1C"},
    {"name": "Honey",     "hex": "#FFC93C"},
    {"name": "Lime",      "hex": "#A7D129"},
    {"name": "Moss",      "hex": "#2FA36B"},
    {"name": "Tide",      "hex": "#13B6A6"},
    {"name": "Sky",       "hex": "#2D9CDB"},
    {"name": "Indigo",    "hex": "#3A49A4"},
    {"name": "Lavender",  "hex": "#8E5BD9"},
    {"name": "Magenta",   "hex": "#D94FA5"},
    {"name": "Rose",      "hex": "#FF6FA3"},
]

U32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & U32


def _hash(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = _imul(h, 16777619)
    return h & U32


# --- color math (port of hexToHsl / hslToHex / resolveColor) -----------------

def hex_to_hsl(hx: str):
    r = int(hx[1:3], 16) / 255
    g = int(hx[3:5], 16) / 255
    b = int(hx[5:7], 16) / 255
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    h = s = 0.0
    if mx != mn:
        d = mx - mn
        s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
        if mx == r:
            h = ((g - b) / d + (6 if g < b else 0)) * 60
        elif mx == g:
            h = ((b - r) / d + 2) * 60
        else:
            h = ((r - g) / d + 4) * 60
    return h, s, l


def hsl_to_hex(h: float, s: float, l: float) -> str:
    h = ((h % 360) + 360) % 360
    s = max(0.0, min(1.0, s))
    l = max(0.0, min(1.0, l))
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:   r, g, b = c, x, 0
    elif h < 120: r, g, b = x, c, 0
    elif h < 180: r, g, b = 0, c, x
    elif h < 240: r, g, b = 0, x, c
    elif h < 300: r, g, b = x, 0, c
    else:         r, g, b = c, 0, x
    to = lambda v: format(round((v + m) * 255), "02x")
    return f"#{to(r)}{to(g)}{to(b)}"


def resolve_color(family_hex: str, serial: str) -> str:
    bh, bs, bl = hex_to_hsl(family_hex)
    digits = [int(d) if d.isdigit() else 0 for d in serial]
    hj = (digits[2] - 5) * 2.2 if len(digits) > 2 else 0
    sj = (digits[3] - 5) * 0.015 if len(digits) > 3 else 0
    lj = (digits[4] - 5) * 0.012 if len(digits) > 4 else 0
    return hsl_to_hex(bh + hj, bs + sj, bl + lj)


def color_for_author(name: str):
    """Stable pop color for a test author (stands in for the quiz result)."""
    idx = _hash(name) % len(POP_PALETTE)
    serial = str(_hash(name + "s") % 1000000).zfill(6)
    fam = POP_PALETTE[idx]
    return {"family": fam["name"], "serial": serial,
            "hex": resolve_color(fam["hex"], serial), "paletteIndex": idx}


# --- emotion analysis --------------------------------------------------------
EMOTION_LEXICON = {
    "anxious": ["worried", "anxious", "nervous", "scared", "afraid", "stress", "stressed", "overwhelmed", "panic", "deadline", "exam"],
    "lonely": ["lonely", "alone", "miss", "missing", "homesick", "far", "empty", "isolated", "nobody"],
    "tired": ["tired", "exhausted", "sleep", "sleepy", "drained", "burnt", "burned", "rest"],
    "sad": ["sad", "down", "cry", "crying", "low", "blue", "hurt", "lost", "grief"],
    "hopeful": ["hope", "hopeful", "maybe", "trying", "better", "soon", "someday", "forward"],
    "grateful": ["grateful", "thankful", "thanks", "lucky", "appreciate", "gift", "kind"],
    "calm": ["calm", "peace", "peaceful", "quiet", "still", "ok", "okay", "fine", "steady", "rest"],
    "joyful": ["happy", "joy", "excited", "love", "great", "amazing", "good", "smile", "fun", "glad"],
    "proud": ["proud", "did it", "finished", "won", "achieved", "accomplished", "progress"],
}


def analyze(text: str, mood: int):
    t = text.lower()
    best_label, best_hits = "reflective", 0
    for label, words in EMOTION_LEXICON.items():
        hits = sum(1 for w in words if w in t)
        if hits > best_hits:
            best_hits, best_label = hits, label
    if best_hits == 0:
        best_label = {1: "heavy", 2: "tender", 3: "reflective", 4: "light", 5: "bright"}[mood]
    excite = sum(t.count(c) for c in "!?")
    mood_extremity = abs(mood - 3) / 2
    intensity = max(0.15, min(1.0, 0.3 + best_hits * 0.18 + excite * 0.08 + mood_extremity * 0.3))
    return best_label, round(intensity, 2)


# --- embedding ---------------------------------------------------------------
STOP = {"the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "at", "is", "am",
        "are", "was", "were", "be", "been", "i", "im", "my", "me", "it", "its", "this",
        "that", "for", "with", "so", "just", "really", "very", "about", "feel", "feeling"}


def embed(text: str):
    vec = [0.0] * EMBED_DIM
    cleaned = "".join(ch if ch.isalpha() or ch.isspace() else " " for ch in text.lower())
    for w in cleaned.split():
        if len(w) <= 2 or w in STOP:
            continue
        vec[_hash(w) % EMBED_DIM] += 1
        vec[_hash(w + "#2") % EMBED_DIM] += 0.5
        stem = w[: max(3, len(w) - 2)]
        vec[_hash(stem) % EMBED_DIM] += 0.6
    norm = math.sqrt(sum(v * v for v in vec)) or 1
    return [v / norm for v in vec]


def cosine_distance(a, b):
    return 1 - sum(x * y for x, y in zip(a, b))


# --- fixed projection (seeded matrix, matches TS LCG) ------------------------

def _seeded_col(salt: int):
    col = []
    state = (1013904223 + salt) & U32
    for _ in range(EMBED_DIM):
        state = (_imul(state, 1664525) + 1013904223) & U32
        col.append((state / U32) * 2 - 1)
    return col


_PROJ = (_seeded_col(7), _seeded_col(31))


def project(embedding):
    x = sum(e * c for e, c in zip(embedding, _PROJ[0]))
    y = sum(e * c for e, c in zip(embedding, _PROJ[1]))
    return x * 2.4, y * 2.4
