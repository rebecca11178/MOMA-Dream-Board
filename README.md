# The Dream Board — prototype

Randomly matched strangers raise a shared digital pet. Each day each person
feeds the pet a mood + one sentence. The pet "reads" the meaning, records it as a
pin on a shared board, and when two people (partners, or strangers in other
pairs) say something close, a line forms and the pet reacts.

Built for the MoMA × Anthropic Creative Sprint — prompt **"Create Connections."**

## Run it

```bash
cd dream-board
npm install
npm run dev
```

Open the local URL on a phone (same Wi‑Fi) or in a browser at mobile width. It's
an installable PWA ("Add to Home Screen").

## What works today (fully client-side, no API keys needed)

- **Onboarding → personal color.** A 6-question quiz + a 6-digit code map you to
  one of **12 curated pop colors**, nudged to a unique shade. (`src/config/palette.ts`,
  `src/lib/personality.ts`)
- **Pairing + the pet.** You're paired with a partner (seeded as "River"). The
  pet is an animated blob that starts a sharp 50/50 split of the two colors and
  **blends more** each time you and your partner say something alike.
- **The blob** — ported from the SwiftUI BlobPet: wobbling Catmull-Rom body,
  two-color partner gradient, glow halo, expressive face, mood/bond "scenes"
  (neutral / dancing / hearts / sulking), and drag-to-squish. (`src/components/Blob.tsx`)
- **Feed loop.** Mood (1–5) + one sentence → the pipeline runs:
  analysis → embedding → fixed 2D projection → link search → pet reply +
  partner/stranger notifications. (`src/lib/brain.ts`, `src/lib/store.ts`)
- **Dreams feed.** The pet's replies and "someone you've never met said the same
  thing" messages — never revealing the other person's words.

## The "brain" is swappable

`src/lib/brain.ts` is a **mock** so the prototype runs with zero setup. Every
function (`analyze`, `embed`, `project`, `petReply`, `nameTheme`) matches what a
Supabase Edge Function calling **Claude + Voyage** would return, so the real
backend can drop in later without touching the UI. The design rule holds: the
brain only analyzes, replies as the pet, and names themes — it never invents a
pin or participant content.

### Tuning

All knobs live in `src/config/palette.ts` → `TUNING` (link threshold, blend step,
embedding dim, max characters) and the `POP_PALETTE` array.

> Note: `linkThreshold` is currently `0.64`, tuned for the coarse mock
> bag-of-words embedder (strong matches land ~0.40, unrelated ~0.68+). With real
> Voyage embeddings this will drop.

## Pop-art render (the portfolio painting)

Standalone Python in `render/` — only needs Pillow. It ports the same brain
(`render/brain.py`) so pins/colors stay consistent with the app, turns a CSV of
sentences into board data, and paints one high-res PNG: flat color fields with
bold outlines and Ben-Day halftone dots, pins sized by intensity/mood, and
connection lines blending the two endpoints' colors.

```bash
cd render
python3 -m venv .venv && ./.venv/bin/pip install Pillow

# generate board data from the sample sentences, then paint
./.venv/bin/python generate_test_data.py --n 50 --out out/board_50.json
./.venv/bin/python render_board.py --in out/board_50.json --out out/painting_50.png

# the 10-vs-50 comparison from the brief
./.venv/bin/python generate_test_data.py --n 10 --out out/board_10.json
./.venv/bin/python render_board.py --in out/board_10.json --out out/painting_10.png
```

Edit the "real sentences" in `render/data/sentences.csv` (`author,mood,text`).
All style knobs are in `render_board.py` → `STYLE` and the emotion→color map in
`generate_test_data.py`.

## Not built yet (next steps)

- **Real backend** — Supabase schema + RLS, Edge Functions, Voyage embeddings,
  the one-time `fit_projection.py`, and `detect_themes.py` (HDBSCAN).
- An **export** button in the app so the renderer can paint the *live* board,
  not just test data.
- Partner pairing by 6-char code for the live demo.

See `../PROTOTYPE_BRIEF.md` for the full plan.
