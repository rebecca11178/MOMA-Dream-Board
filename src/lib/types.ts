// Data model, mirroring the Supabase schema in the brief but kept client-side
// for the prototype. Field names match so the real backend can drop in later.

export interface Participant {
  id: string;
  displayName: string;
  colorHex: string;
  paletteIndex: number;
  colorName: string;
  serial: string;
  createdAt: number;
}

export interface Pair {
  id: string;
  participantA: string;
  participantB: string;
  /** 0 = split 50:50 in the two colors, grows toward a shared blend. */
  blendRatio: number;
  createdAt: number;
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface Message {
  id: string;
  participantId: string;
  pairId: string | null;
  mood: Mood;
  text: string;
  emotionLabel: string;
  intensity: number; // 0..1
  embedding: number[];
  x: number;
  y: number;
  createdAt: number;
}

export type LinkKind = "partner" | "stranger";

export interface Link {
  id: string;
  messageA: string;
  messageB: string;
  distance: number;
  kind: LinkKind;
  createdAt: number;
}

export type NotificationKind =
  | "reply"
  | "partner_link"
  | "stranger_link"
  | "theme";

export interface AppNotification {
  id: string;
  participantId: string;
  kind: NotificationKind;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface Theme {
  id: string;
  name: string;
  centroidX: number;
  centroidY: number;
  memberCount: number;
  status: "proposed" | "confirmed";
  createdAt: number;
}
