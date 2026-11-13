// Seed data so the board already has life in it for the demo: a partner, and a
// handful of "strangers" in other pairs whose messages can link to the user's.
// These are stand-ins for the real friends' CSV mentioned in the brief.

import { POP_PALETTE } from "../config/palette";

export interface SeedStranger {
  name: string;
  paletteIndex: number;
  serial: string;
  sentences: string[];
}

export const SEED_PARTNER = {
  name: "River",
  paletteIndex: 7, // Sky
  serial: "204815",
};

export const SEED_STRANGERS: SeedStranger[] = [
  {
    name: "Mika",
    paletteIndex: 9,
    serial: "771203",
    sentences: [
      "I miss home more than I expected to this week.",
      "The city is loud but I still feel alone in it.",
    ],
  },
  {
    name: "Theo",
    paletteIndex: 0,
    serial: "330192",
    sentences: [
      "Big deadline tomorrow and I'm so stressed I can't eat.",
      "Finally finished the project, I'm proud of what we made.",
    ],
  },
  {
    name: "Noa",
    paletteIndex: 5,
    serial: "905514",
    sentences: [
      "Went for a slow walk and the quiet helped me breathe.",
      "Trying to be hopeful that things get better soon.",
    ],
  },
  {
    name: "Sora",
    paletteIndex: 11,
    serial: "118740",
    sentences: [
      "Grateful for the friend who called just to check on me.",
      "So tired lately, I just want to rest for a whole day.",
    ],
  },
  {
    name: "Dax",
    paletteIndex: 2,
    serial: "640271",
    sentences: [
      "Homesick tonight, missing my mom's cooking.",
      "Had a good laugh with strangers today, felt light.",
    ],
  },
];

export function colorHexFor(paletteIndex: number, serial: string): string {
  // kept here so seed.ts has no import cycle with palette's resolveColor
  const fam = POP_PALETTE[paletteIndex];
  return fam.hex; // seeds use the flat family color; exact shade not important
}
