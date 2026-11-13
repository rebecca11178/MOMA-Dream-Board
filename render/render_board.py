"""Render one high-resolution pop-art painting from board_data.json.

Pop-art recipe (from the brief):
  - flat color, bold black outlines, no gradients
  - each pin = a dot in its author's color, size from intensity + mood
  - each connection = a stroke blending the two endpoint colors
  - dense clusters = flat color fields with Ben-Day halftone dots inside
  - theme names as small labels

Only dependency: Pillow.

Usage:
  python3 render_board.py --in out/board_50.json --out out/painting_50.png
"""
from __future__ import annotations
import argparse, json, math, os
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageFont

# ---- all tunable style values in one place --------------------------------
STYLE = {
    "size": 2200,
    "margin": 320,
    "bg": "#F3EAD6",            # warm paper
    "outline": "#1A1622",       # bold near-black
    "field_radius": 100,        # per-member radius used to grow a field blob
    "field_blur": 54,
    "field_threshold": 54,
    "field_outline_px": 9,
    "benday_step": 46,          # spacing of halftone dots
    "pin_base": 13,
    "link_width": 5,
    "link_alpha": 115,
    "title": "THE DREAM BOARD",
}

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
]


def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def hex_to_rgb(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def blend(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--in", dest="inp", default=os.path.join(here, "out", "board_50.json"))
    ap.add_argument("--out", default=os.path.join(here, "out", "painting_50.png"))
    args = ap.parse_args()

    with open(args.inp, encoding="utf-8") as f:
        data = json.load(f)

    W = H = STYLE["size"]
    M = STYLE["margin"]
    b = data["bounds"]
    dx = (b["maxx"] - b["minx"]) or 1
    dy = (b["maxy"] - b["miny"]) or 1

    def to_px(x, y):
        nx = (x - b["minx"]) / dx
        ny = (y - b["miny"]) / dy
        return (M + nx * (W - 2 * M), M + ny * (H - 2 * M))

    outline = hex_to_rgb(STYLE["outline"])
    canvas = Image.new("RGBA", (W, H), hex_to_rgb(STYLE["bg"]) + (255,))

    # ---- 1. color fields (dense theme clusters) ----------------------------
    for theme in data["themes"]:
        members = [data["messages"][i] for i in theme["members"]]
        color = hex_to_rgb(theme["color"])

        field = Image.new("L", (W, H), 0)
        fd = ImageDraw.Draw(field)
        for m in members:
            px, py = to_px(m["x"], m["y"])
            r = STYLE["field_radius"]
            fd.ellipse([px - r, py - r, px + r, py + r], fill=255)
        field = field.filter(ImageFilter.GaussianBlur(STYLE["field_blur"]))
        field = field.point(lambda p: 255 if p > STYLE["field_threshold"] else 0)

        # flat fill
        fill_img = Image.new("RGBA", (W, H), color + (255,))
        canvas.paste(fill_img, (0, 0), field)

        # Ben-Day halftone dots (size from average mood)
        avg_mood = sum(m["mood"] for m in members) / len(members)
        dot_r = 4 + (avg_mood - 1) / 4 * 9
        dot_color = blend(color, (255, 255, 255), 0.55)
        dots = Image.new("L", (W, H), 0)
        dd = ImageDraw.Draw(dots)
        step = STYLE["benday_step"]
        for gx in range(0, W, step):
            for gy in range(0, H, step):
                dd.ellipse([gx - dot_r, gy - dot_r, gx + dot_r, gy + dot_r], fill=255)
        inside = ImageChops.multiply(dots, field)
        dot_img = Image.new("RGBA", (W, H), dot_color + (255,))
        canvas.paste(dot_img, (0, 0), inside)

        # bold outline around the field
        dil = field.filter(ImageFilter.MaxFilter(STYLE["field_outline_px"] * 2 + 1))
        edge = ImageChops.subtract(dil, field)
        edge_img = Image.new("RGBA", (W, H), outline + (255,))
        canvas.paste(edge_img, (0, 0), edge)

    # ---- 2. connection lines -----------------------------------------------
    links = data["links"]
    width = STYLE["link_width"]
    alpha = STYLE["link_alpha"]
    if len(links) > 140:          # thin out when very dense
        width = max(3, width - 2)
        alpha = max(60, alpha - 45)
    link_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(link_layer)
    for lk in links:
        a = to_px(lk["ax"], lk["ay"])
        c = to_px(lk["bx"], lk["by"])
        col = blend(hex_to_rgb(lk["ca"]), hex_to_rgb(lk["cb"]), 0.5)
        ld.line([a, c], fill=col + (alpha,), width=width)
    canvas = Image.alpha_composite(canvas, link_layer)

    # ---- 3. pins ------------------------------------------------------------
    draw = ImageDraw.Draw(canvas)
    for m in data["messages"]:
        px, py = to_px(m["x"], m["y"])
        r = STYLE["pin_base"] + m["intensity"] * 20 + (m["mood"] - 1) * 2.2
        col = hex_to_rgb(m["colorHex"])
        draw.ellipse([px - r, py - r, px + r, py + r], fill=col, outline=outline, width=3)
        hr = r * 0.3
        hi = (px - r * 0.35, py - r * 0.35)
        draw.ellipse([hi[0] - hr, hi[1] - hr, hi[0] + hr, hi[1] + hr],
                     fill=(255, 255, 255, 200))

    # ---- 4. theme labels ----------------------------------------------------
    label_font = load_font(42)
    for theme in data["themes"]:
        cx, cy = to_px(theme["cx"], theme["cy"])
        text = theme["name"]
        tb = draw.textbbox((0, 0), text, font=label_font)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        pad = 14
        box = [cx - tw / 2 - pad, cy - th / 2 - pad, cx + tw / 2 + pad, cy + th / 2 + pad]
        draw.rounded_rectangle(box, radius=16, fill=(255, 255, 255, 235), outline=outline, width=4)
        draw.text((cx - tw / 2, cy - th / 2 - tb[1]), text, font=label_font, fill=outline)

    # ---- 5. title + caption -------------------------------------------------
    title_font = load_font(78)
    cap_font = load_font(38)
    draw.text((M, M - 150), STYLE["title"], font=title_font, fill=outline)
    n = len(data["messages"])
    th = len(data["themes"])
    caption = f'{n} voices · {len(links)} connections · {th} themes'
    draw.text((M, H - M + 70), caption, font=cap_font, fill=outline)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    canvas.convert("RGB").save(args.out, "PNG")
    print(f"wrote {args.out} ({W}x{H})")


if __name__ == "__main__":
    main()
