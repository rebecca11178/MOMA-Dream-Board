// Short onboarding quiz. 6 questions, each option adds points to one or more
// of the 12 pop families (by palette index). The winner becomes the person's
// color family; the numeric code then sets the exact shade.

import { POP_PALETTE } from "../config/palette";

export interface QuizOption {
  id: string;
  text: string;
  /** palette index -> points */
  scores: Record<number, number>;
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: QuizOption[];
}

// Indices (for readability): 0 Ember,1 Coral,2 Tangerine,3 Honey,4 Lime,
// 5 Moss,6 Tide,7 Sky,8 Indigo,9 Lavender,10 Magenta,11 Rose
export const QUIZ: QuizQuestion[] = [
  {
    id: 1,
    prompt: "First thing in the morning, you most want to…",
    options: [
      { id: "1a", text: "Get outside and move while the air is fresh", scores: { 7: 2, 6: 1, 4: 1 } },
      { id: "1b", text: "Make something warm and stay quiet for a while", scores: { 3: 2, 2: 1, 5: 1 } },
      { id: "1c", text: "Send a good-morning to someone you care about", scores: { 11: 2, 10: 1, 1: 1 } },
      { id: "1d", text: "Lie there a bit longer and think", scores: { 9: 2, 8: 1 } },
    ],
  },
  {
    id: 2,
    prompt: "A plan falls through last minute. You…",
    options: [
      { id: "2a", text: "Rally someone else — the night can't go to waste", scores: { 0: 2, 1: 1, 3: 1 } },
      { id: "2b", text: "Go solo and do the thing you meant to do anyway", scores: { 6: 2, 7: 1, 5: 1 } },
      { id: "2c", text: "Stay in, comfort show, comfort food", scores: { 2: 1, 3: 2 } },
      { id: "2d", text: "Feel a little blue — being cancelled on stings", scores: { 9: 2, 11: 1 } },
    ],
  },
  {
    id: 3,
    prompt: "Most of your closet is…",
    options: [
      { id: "3a", text: "Black, white, grey — never wrong", scores: { 8: 2 } },
      { id: "3b", text: "Earth tones, beige, khaki", scores: { 5: 2, 3: 1 } },
      { id: "3c", text: "Bright and bold, a bit of everything", scores: { 0: 1, 2: 2, 10: 1 } },
      { id: "3d", text: "Quiet blues, greens, and purples", scores: { 7: 2, 6: 1, 9: 1 } },
    ],
  },
  {
    id: 4,
    prompt: "You feel most yourself when…",
    options: [
      { id: "4a", text: "You're all-in on something, full throttle", scores: { 0: 2, 2: 1 } },
      { id: "4b", text: "You're in flow and everything feels easy", scores: { 6: 2, 7: 1, 4: 1 } },
      { id: "4c", text: "You're quietly close to one or two people", scores: { 11: 2, 9: 1 } },
      { id: "4d", text: "You're alone, far from the noise", scores: { 8: 2, 9: 1 } },
    ],
  },
  {
    id: 5,
    prompt: "You'd hate most to lose your…",
    options: [
      { id: "5a", text: "Drive and passion", scores: { 0: 2, 1: 1 } },
      { id: "5b", text: "Own pace", scores: { 6: 2, 5: 1 } },
      { id: "5c", text: "Deep connections", scores: { 11: 2, 10: 1 } },
      { id: "5d", text: "Sense of meaning", scores: { 8: 1, 9: 1, 5: 1 } },
    ],
  },
  {
    id: 6,
    prompt: "The most soothing sound to you is…",
    options: [
      { id: "6a", text: "Rain on the window", scores: { 5: 1, 8: 1, 9: 1 } },
      { id: "6b", text: "Waves in the distance", scores: { 6: 2, 7: 1 } },
      { id: "6c", text: "Fingerpicked guitar", scores: { 3: 1, 2: 1, 1: 1 } },
      { id: "6d", text: "Footsteps of someone you know", scores: { 11: 2, 10: 1 } },
    ],
  },
];

export function winningIndex(picks: string[]): number {
  const scores: Record<number, number> = {};
  POP_PALETTE.forEach((p) => (scores[p.index] = 0));
  const byId: Record<string, QuizOption> = {};
  QUIZ.forEach((q) => q.options.forEach((o) => (byId[o.id] = o)));
  for (const pick of picks) {
    const opt = byId[pick];
    if (!opt) continue;
    for (const [idx, pts] of Object.entries(opt.scores)) {
      scores[Number(idx)] += pts;
    }
  }
  let best = 0;
  let bestScore = -1;
  for (const p of POP_PALETTE) {
    if (scores[p.index] > bestScore) {
      bestScore = scores[p.index];
      best = p.index;
    }
  }
  return best;
}
