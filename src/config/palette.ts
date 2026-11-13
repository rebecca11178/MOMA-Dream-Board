// The curated pop palette. All style/tuning values live here so they are easy
// to adjust (per the brief: "hard-code the palette in one config file").
//
// 12 bold, flat pop-art colors spread around the wheel. A participant's
// onboarding answers pick a family; their numeric code nudges the exact shade,
// so two people in the same family still land on slightly different colors.

export interface PopColor {
  index: number;
  /** English family name, used in the color's display name. */
  name: string;
  /** One-line, warm description shown at the color reveal. */
  tagline: string;
  /** Base hex (flat pop color). */
  hex: string;
  /** Base hue 0-360, used for blend math and code-driven jitter. */
  hue: number;
}

export const POP_PALETTE: PopColor[] = [
  { index: 0,  name: "Ember",     hue: 8,   hex: "#F0392B", tagline: "You carry a spark that lights a room without trying." },
  { index: 1,  name: "Coral",     hue: 16,  hex: "#FF6B4A", tagline: "Warm, quick to reach out, easy to stand near." },
  { index: 2,  name: "Tangerine", hue: 30,  hex: "#FF9F1C", tagline: "You turn ordinary days a little brighter." },
  { index: 3,  name: "Honey",     hue: 46,  hex: "#FFC93C", tagline: "Your warmth is the kind people lean on to stay warm." },
  { index: 4,  name: "Lime",      hue: 78,  hex: "#A7D129", tagline: "Fresh starts follow you around." },
  { index: 5,  name: "Moss",      hue: 140, hex: "#2FA36B", tagline: "You grow slowly, but every step puts down roots." },
  { index: 6,  name: "Tide",      hue: 174, hex: "#13B6A6", tagline: "You keep your own rhythm; no wave pushes you off it." },
  { index: 7,  name: "Sky",       hue: 205, hex: "#2D9CDB", tagline: "Your mind is wide enough to hold far-away places." },
  { index: 8,  name: "Indigo",    hue: 232, hex: "#3A49A4", tagline: "You go deep, and you bring things back from down there." },
  { index: 9,  name: "Lavender",  hue: 272, hex: "#8E5BD9", tagline: "You hear frequencies other people miss." },
  { index: 10, name: "Magenta",   hue: 318, hex: "#D94FA5", tagline: "You feel things in full color, out loud." },
  { index: 11, name: "Rose",      hue: 340, hex: "#FF6FA3", tagline: "You take every bit of tenderness seriously." },
];

// --- color math -----------------------------------------------------------

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

/**
 * Final personal color: the family's flat pop color, nudged by the 6-digit
 * code so it is personal. Stays bold and pop (small jitter only).
 */
export function resolveColor(family: PopColor, serial: string): string {
  const base = hexToHsl(family.hex);
  const digits = serial.split("").map((d) => parseInt(d, 10) || 0);
  const hJ = digits[2] !== undefined ? (digits[2] - 5) * 2.2 : 0; // +/- ~11 deg
  const sJ = digits[3] !== undefined ? (digits[3] - 5) * 0.015 : 0;
  const lJ = digits[4] !== undefined ? (digits[4] - 5) * 0.012 : 0;
  return hslToHex(base.h + hJ, base.s + sJ, base.l + lJ);
}

export function colorDisplayName(family: PopColor, serial: string): string {
  return `${family.name} #${serial}`;
}

// --- render / tuning knobs (shared by app + render script) -----------------

export const TUNING = {
  /** cosine-distance threshold below which two pins link.
   *  Tuned for the mock bag-of-words embedder, where a strong semantic match
   *  lands around 0.4 and unrelated messages sit at 0.68+. The real Voyage
   *  embeddings cluster more tightly, so this will drop when the brain is live. */
  linkThreshold: 0.64,
  /** blend_ratio step added on each partner link. */
  blendStep: 0.06,
  /** embedding dimension used by the mock brain. */
  embedDim: 64,
  /** max characters for one message. */
  maxChars: 200,
};
