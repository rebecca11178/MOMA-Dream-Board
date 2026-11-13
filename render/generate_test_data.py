"""Create fake participants + pairs from a CSV of real sentences and push every
message through the ported pipeline, then write board_data.json for the renderer.

Usage:
  python3 generate_test_data.py --n 50 --out out/board_50.json
  python3 generate_test_data.py --n 10 --out out/board_10.json

CSV columns: author,mood,text
"""
from __future__ import annotations
import argparse, csv, json, math, os, random, re, statistics
import brain

STOP = brain.STOP

# Bold pop color per emotion, so each theme field reads as one saturated flat
# (averaging author colors turns to mud). Pins keep their own author colors.
EMOTION_COLOR = {
    "lonely": "#3A49A4",    # indigo   (homesick / miss)
    "anxious": "#F0392B",   # ember    (deadline / stress)
    "tired": "#8E5BD9",     # lavender
    "sad": "#2D6CDB",       # blue
    "hopeful": "#A7D129",   # lime     (hope)
    "grateful": "#FFC93C",  # honey
    "calm": "#13B6A6",      # tide     (quiet)
    "joyful": "#FF6FA3",    # rose     (love / happy)
    "proud": "#FF9F1C",     # tangerine
    "reflective": "#9AA0B5",
}


def hex_to_rgb(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def rgb_to_hex(rgb):
    return "#" + "".join(format(max(0, min(255, int(round(c)))), "02x") for c in rgb)


def average_hex(hexes):
    rgbs = [hex_to_rgb(h) for h in hexes]
    return rgb_to_hex([statistics.mean(c) for c in zip(*rgbs)])


def name_theme(texts):
    counts = {}
    for t in texts:
        for w in re.sub(r"[^a-z\s]", " ", t.lower()).split():
            if len(w) > 3 and w not in STOP:
                counts[w] = counts.get(w, 0) + 1
    if not counts:
        return "something shared"
    return max(counts.items(), key=lambda kv: kv[1])[0]


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--csv", default=os.path.join(here, "data", "sentences.csv"))
    ap.add_argument("--n", type=int, default=50, help="max number of messages/people")
    ap.add_argument("--link-threshold", type=float, default=0.6,
                    help="max cosine distance for a nearest-neighbor link")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=os.path.join(here, "out", "board_50.json"))
    args = ap.parse_args()

    random.seed(args.seed)

    with open(args.csv, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("text", "").strip()]
    random.shuffle(rows)
    rows = rows[: args.n]

    # participants (one per author here) + pairs
    authors = list(dict.fromkeys(r["author"] for r in rows))
    colors = {a: brain.color_for_author(a) for a in authors}
    shuffled = authors[:]
    random.shuffle(shuffled)
    pair_of = {}
    for i in range(0, len(shuffled), 2):
        pid = i // 2
        pair_of[shuffled[i]] = pid
        if i + 1 < len(shuffled):
            pair_of[shuffled[i + 1]] = pid

    # messages through the pipeline
    messages = []
    for r in rows:
        author = r["author"]
        mood = int(r["mood"])
        text = r["text"].strip()
        emb = brain.embed(text)
        x, y = brain.project(emb)
        emotion, intensity = brain.analyze(text, mood)
        c = colors[author]
        messages.append({
            "author": author, "colorHex": c["hex"], "paletteIndex": c["paletteIndex"],
            "mood": mood, "intensity": intensity, "emotion": emotion, "text": text,
            "pairId": pair_of[author], "x": x, "y": y, "_emb": emb,
        })

    # Link search: nearest similar neighbor per pin (by embedding), indices only.
    link_pairs = []
    seen = set()
    linked_ids = set()
    for i in range(len(messages)):
        best, best_d = None, 9.0
        for j in range(len(messages)):
            if i == j:
                continue
            d = brain.cosine_distance(messages[i]["_emb"], messages[j]["_emb"])
            if d < best_d:
                best_d, best = d, j
        if best is not None and best_d < args.link_threshold:
            key = tuple(sorted((i, best)))
            if key in seen:
                continue
            seen.add(key)
            linked_ids.update(key)
            link_pairs.append((i, best, round(best_d, 3)))

    # Emotion groups; those with >=3 members become color fields with a region.
    groups = {}
    for idx, m in enumerate(messages):
        groups.setdefault(m["emotion"], []).append(idx)
    field_emotions = sorted((e for e, mem in groups.items() if len(mem) >= 3),
                            key=lambda e: -len(groups[e]))

    # Layout: give each field its own region on a ring; place its members in a
    # tight phyllotaxis disk so the field reads as one clean shape. Positions in
    # a 0..1 space (the renderer maps bounds -> canvas). Small groups scatter in
    # the gaps. This keeps fields separate instead of overlapping puddles.
    def disk_layout(members, cx, cy, radius):
        n = len(members)
        for k, idx in enumerate(members):
            ang = k * 2.399963
            rr = radius * math.sqrt((k + 0.5) / n)
            messages[idx]["x"] = cx + math.cos(ang) * rr
            messages[idx]["y"] = cy + math.sin(ang) * rr

    K = len(field_emotions)
    for i, emo in enumerate(field_emotions):
        ang = (i / max(1, K)) * 2 * math.pi - math.pi / 2
        ring = 0.34 if K > 1 else 0.0
        cx = 0.5 + math.cos(ang) * ring
        cy = 0.5 + math.sin(ang) * ring
        rad = 0.07 + 0.009 * len(groups[emo])
        disk_layout(groups[emo], cx, cy, rad)

    small = [idx for e, mem in groups.items() if len(mem) < 3 for idx in mem]
    for k, idx in enumerate(small):
        ang = (k / max(1, len(small))) * 2 * math.pi + 0.5
        messages[idx]["x"] = 0.5 + math.cos(ang) * 0.5
        messages[idx]["y"] = 0.5 + math.sin(ang) * 0.5

    # Build link coords + themes from the final positions.
    links = []
    for i, j, d in link_pairs:
        a, b = messages[i], messages[j]
        kind = "partner" if a["pairId"] == b["pairId"] else "stranger"
        links.append({
            "ax": a["x"], "ay": a["y"], "bx": b["x"], "by": b["y"],
            "ca": a["colorHex"], "cb": b["colorHex"],
            "kind": kind, "distance": d,
        })

    themes = []
    for emo in field_emotions:
        members = groups[emo]
        ms = [messages[i] for i in members]
        themes.append({
            "name": name_theme([m["text"] for m in ms]),
            "emotion": emo,
            "cx": statistics.mean(m["x"] for m in ms),
            "cy": statistics.mean(m["y"] for m in ms),
            "count": len(ms),
            "color": EMOTION_COLOR.get(emo, average_hex([m["colorHex"] for m in ms])),
            "members": members,
        })

    for m in messages:
        del m["_emb"]

    xs = [m["x"] for m in messages]
    ys = [m["y"] for m in messages]
    data = {
        "participants": [{"name": a, **colors[a]} for a in authors],
        "messages": messages,
        "links": links,
        "themes": themes,
        "bounds": {"minx": min(xs), "maxx": max(xs), "miny": min(ys), "maxy": max(ys)},
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"{len(messages)} messages, {len(links)} links, {len(themes)} themes "
          f"-> {args.out}")
    print(f"  ~{round(100 * len(linked_ids) / len(messages))}% of pins have a link")
    for t in sorted(themes, key=lambda t: -t["count"]):
        print(f"  theme '{t['name']}' x{t['count']}")


if __name__ == "__main__":
    main()
