// The "brain": everything the backend pipeline does to a message.
//
// By default this is a fully client-side MOCK so the prototype runs with no API
// keys. Every function is written so a `live` implementation (Supabase Edge
// Function calling Claude + Voyage) can replace it one-to-one later.
//
// DESIGN RULE (non-negotiable, from the brief): the brain never invents a pin or
// participant content. It only analyzes, replies as the pet, and names themes.

import { TUNING } from "../config/palette";
import type { Mood } from "./types";

// --- 1. Emotion analysis ---------------------------------------------------

const EMOTION_LEXICON: Record<string, string[]> = {
  anxious: ["worried", "anxious", "nervous", "scared", "afraid", "stress", "stressed", "overwhelmed", "panic", "deadline", "exam"],
  lonely: ["lonely", "alone", "miss", "missing", "homesick", "far", "empty", "isolated", "nobody"],
  tired: ["tired", "exhausted", "sleep", "sleepy", "drained", "burnt", "burned", "rest"],
  sad: ["sad", "down", "cry", "crying", "low", "blue", "hurt", "lost", "grief"],
  hopeful: ["hope", "hopeful", "maybe", "trying", "better", "soon", "someday", "forward"],
  grateful: ["grateful", "thankful", "thanks", "lucky", "appreciate", "gift", "kind"],
  calm: ["calm", "peace", "peaceful", "quiet", "still", "ok", "okay", "fine", "steady", "rest"],
  joyful: ["happy", "joy", "excited", "love", "great", "amazing", "good", "smile", "fun", "glad"],
  proud: ["proud", "did it", "finished", "won", "achieved", "accomplished", "progress"],
};

export interface Analysis {
  emotionLabel: string;
  intensity: number; // 0..1
}

export function analyze(text: string, mood: Mood): Analysis {
  const t = text.toLowerCase();
  let bestLabel = "reflective";
  let bestHits = 0;
  for (const [label, words] of Object.entries(EMOTION_LEXICON)) {
    let hits = 0;
    for (const w of words) if (t.includes(w)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      bestLabel = label;
    }
  }
  // Fall back to mood when no keywords matched.
  if (bestHits === 0) {
    bestLabel =
      mood <= 1 ? "heavy" : mood === 2 ? "tender" : mood === 3 ? "reflective" : mood === 4 ? "light" : "bright";
  }
  // Intensity: blend keyword density, punctuation, and mood extremity.
  const excite = (text.match(/[!?]/g) || []).length;
  const moodExtremity = Math.abs(mood - 3) / 2; // 0..1
  const intensity = Math.max(
    0.15,
    Math.min(1, 0.3 + bestHits * 0.18 + excite * 0.08 + moodExtremity * 0.3)
  );
  return { emotionLabel: bestLabel, intensity: Number(intensity.toFixed(2)) };
}

// --- 2. Embedding (deterministic, meaning-aware enough for a demo) ----------

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "at", "is", "am",
  "are", "was", "were", "be", "been", "i", "im", "my", "me", "it", "its", "this",
  "that", "for", "with", "so", "just", "really", "very", "about", "feel", "feeling",
]);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bag-of-words hashed embedding, L2-normalized. Shared words -> closer vectors. */
export function embed(text: string): number[] {
  const dim = TUNING.embedDim;
  const vec = new Array(dim).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  for (const w of words) {
    // Spread each word over a few buckets so near-synonyms overlap a little.
    const h = hash(w);
    vec[h % dim] += 1;
    vec[hash(w + "#2") % dim] += 0.5;
    const stem = w.slice(0, Math.max(3, w.length - 2));
    vec[hash(stem) % dim] += 0.6;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return 1 - dot; // both are unit vectors
}

// --- 3. Fixed projection to 2D (pins never move after they land) ------------

// Deterministic pseudo-random projection matrix (dim x 2), seeded once.
function seededMatrix(dim: number): [number[], number[]] {
  const col = (salt: number) => {
    const c: number[] = [];
    let state = 1013904223 + salt;
    for (let i = 0; i < dim; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      c.push((state / 0xffffffff) * 2 - 1);
    }
    return c;
  };
  return [col(7), col(31)];
}

const PROJECTION = seededMatrix(TUNING.embedDim);

/** Project an embedding to [x, y] in roughly [-1, 1]. */
export function project(embedding: number[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < embedding.length; i++) {
    x += embedding[i] * PROJECTION[0][i];
    y += embedding[i] * PROJECTION[1][i];
  }
  // Scale so the scatter spreads across the canvas.
  return { x: Number((x * 2.4).toFixed(4)), y: Number((y * 2.4).toFixed(4)) };
}

// --- 4. Pet reply (warm, simple, never advice, never leaks the other person) -

const REPLIES: Record<string, string[]> = {
  anxious: ["so many clouds today. i stayed close.", "that sounds like a lot to hold. i'm here, small and warm."],
  lonely: ["i felt you reach out. i reached back.", "you're not the only warm thing in the dark. i'm here too."],
  tired: ["rest. i'll keep the little light on.", "soft day. we can be slow together."],
  sad: ["i curled up next to the feeling with you.", "i don't have big words. i have a warm side. lean on it."],
  heavy: ["heavy day. i got a little heavier too, to match.", "i sat with it. we don't have to fix it tonight."],
  hopeful: ["i felt something lift. me too.", "a tiny door opened. i peeked through with you."],
  grateful: ["that made me glow a bit brighter.", "warm thing in, warm thing out. thank you for it."],
  calm: ["we breathed at the same speed just now.", "quiet is good. i like quiet with you."],
  tender: ["soft. i went soft too.", "i held that gently."],
  reflective: ["i turned that over a few times, slowly.", "mm. i'm still thinking about it with you."],
  light: ["that made me bounce a little.", "lighter. i felt it."],
  bright: ["you were bright today and i caught some.", "woo. i did a tiny spin."],
  joyful: ["i did a full spin. you brought that.", "my colors went loud for a second!"],
  proud: ["you did a thing. i'm puffed up about it.", "look at you. i'm beaming in your color."],
};

export function petReply(analysis: Analysis): string {
  const pool = REPLIES[analysis.emotionLabel] || REPLIES.reflective;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

// --- 5. Theme naming (used by the board pipeline; mock here) ----------------

export function nameTheme(sentences: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of sentences) {
    for (const w of s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)) {
      if (w.length > 3 && !STOP.has(w)) counts[w] = (counts[w] || 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "something shared";
}
