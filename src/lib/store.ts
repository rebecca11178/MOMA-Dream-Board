import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  POP_PALETTE,
  resolveColor,
  colorDisplayName,
  TUNING,
} from "../config/palette";
import {
  analyze,
  embed,
  project,
  cosineDistance,
  petReply,
} from "./brain";
import { SEED_PARTNER, SEED_STRANGERS } from "./seed";
import type {
  Participant,
  Pair,
  Message,
  Link,
  AppNotification,
  Mood,
} from "./types";

const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

interface State {
  onboarded: boolean;
  devMode: boolean;
  meId: string | null;
  participants: Record<string, Participant>;
  pairs: Record<string, Pair>;
  messages: Record<string, Message>;
  links: Record<string, Link>;
  notifications: AppNotification[];

  // actions
  completeOnboarding: (displayName: string, picks: string[], serial: string, familyIndex: number) => void;
  submitMessage: (mood: Mood, text: string) => { linksMade: number };
  markAllRead: () => void;
  setDevMode: (v: boolean) => void;
  reset: () => void;
}

function makeParticipant(
  displayName: string,
  paletteIndex: number,
  serial: string
): Participant {
  const fam = POP_PALETTE[paletteIndex];
  return {
    id: uid(),
    displayName,
    paletteIndex,
    serial,
    colorHex: resolveColor(fam, serial),
    colorName: colorDisplayName(fam, serial),
    createdAt: Date.now(),
  };
}

function insertProcessed(
  draft: {
    messages: Record<string, Message>;
    participantId: string;
    pairId: string | null;
    mood: Mood;
    text: string;
  }
): Message {
  const a = analyze(draft.text, draft.mood);
  const emb = embed(draft.text);
  const { x, y } = project(emb);
  const msg: Message = {
    id: uid(),
    participantId: draft.participantId,
    pairId: draft.pairId,
    mood: draft.mood,
    text: draft.text,
    emotionLabel: a.emotionLabel,
    intensity: a.intensity,
    embedding: emb,
    x,
    y,
    createdAt: Date.now(),
  };
  return msg;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false,
      devMode: true,
      meId: null,
      participants: {},
      pairs: {},
      messages: {},
      links: {},
      notifications: [],

      completeOnboarding: (displayName, _picks, serial, familyIndex) => {
        const me = makeParticipant(displayName || "You", familyIndex, serial);
        const partner = makeParticipant(
          SEED_PARTNER.name,
          SEED_PARTNER.paletteIndex,
          SEED_PARTNER.serial
        );
        const pair: Pair = {
          id: uid(),
          participantA: me.id,
          participantB: partner.id,
          blendRatio: 0,
          createdAt: Date.now(),
        };

        const participants: Record<string, Participant> = {
          [me.id]: me,
          [partner.id]: partner,
        };
        const messages: Record<string, Message> = {};

        // Partner seed message (so a partner link can form in the demo).
        const partnerSeed = insertProcessed({
          messages,
          participantId: partner.id,
          pairId: pair.id,
          mood: 3,
          text: "Quiet night here. Trying to be hopeful that things get better soon.",
        });
        messages[partnerSeed.id] = partnerSeed;

        // Strangers in other pairs.
        for (const s of SEED_STRANGERS) {
          const sp = makeParticipant(s.name, s.paletteIndex, s.serial);
          participants[sp.id] = sp;
          const otherPairId = uid();
          for (const text of s.sentences) {
            const m = insertProcessed({
              messages,
              participantId: sp.id,
              pairId: otherPairId,
              mood: 3,
              text,
            });
            messages[m.id] = m;
          }
        }

        set({
          onboarded: true,
          meId: me.id,
          participants,
          pairs: { [pair.id]: pair },
          messages,
          links: {},
          notifications: [
            {
              id: uid(),
              participantId: me.id,
              kind: "reply",
              body: `You've been paired with ${partner.displayName}. Your pet is half ${me.colorName.split(" ")[0]}, half ${partner.colorName.split(" ")[0]}.`,
              read: false,
              createdAt: Date.now(),
            },
          ],
        });
      },

      submitMessage: (mood, text) => {
        const state = get();
        const meId = state.meId;
        if (!meId) return { linksMade: 0 };
        const myPair = Object.values(state.pairs).find(
          (p) => p.participantA === meId || p.participantB === meId
        );
        const pairId = myPair?.id ?? null;
        const partnerId =
          myPair && (myPair.participantA === meId ? myPair.participantB : myPair.participantA);

        const msg = insertProcessed({
          messages: state.messages,
          participantId: meId,
          pairId,
          mood,
          text: text.slice(0, TUNING.maxChars),
        });

        const messages = { ...state.messages, [msg.id]: msg };
        const links = { ...state.links };
        const notifications = [...state.notifications];
        let blendBump = 0;
        let linksMade = 0;

        // Link search over all existing messages (exclude my own).
        for (const other of Object.values(state.messages)) {
          if (other.participantId === meId) continue;
          const d = cosineDistance(msg.embedding, other.embedding);
          if (d < TUNING.linkThreshold) {
            const isPartner = !!partnerId && other.participantId === partnerId;
            const link: Link = {
              id: uid(),
              messageA: msg.id,
              messageB: other.id,
              distance: Number(d.toFixed(3)),
              kind: isPartner ? "partner" : "stranger",
              createdAt: Date.now(),
            };
            links[link.id] = link;
            linksMade++;
            if (isPartner) {
              blendBump += TUNING.blendStep;
              notifications.push({
                id: uid(),
                participantId: meId,
                kind: "partner_link",
                body: "You and your partner said something close tonight. Your pet blended a little more.",
                read: false,
                createdAt: Date.now(),
              });
            } else {
              notifications.push({
                id: uid(),
                participantId: meId,
                kind: "stranger_link",
                body: "Someone you've never met told me almost the same thing.",
                read: false,
                createdAt: Date.now(),
              });
            }
          }
        }

        // Pet reply (always).
        notifications.push({
          id: uid(),
          participantId: meId,
          kind: "reply",
          body: petReply({ emotionLabel: msg.emotionLabel, intensity: msg.intensity }),
          read: false,
          createdAt: Date.now(),
        });

        // Apply blend bump to my pair.
        const pairs = { ...state.pairs };
        if (myPair && blendBump > 0) {
          pairs[myPair.id] = {
            ...myPair,
            blendRatio: Math.min(1, myPair.blendRatio + blendBump),
          };
        }

        set({ messages, links, notifications, pairs });
        return { linksMade };
      },

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      setDevMode: (v) => set({ devMode: v }),

      reset: () =>
        set({
          onboarded: false,
          meId: null,
          participants: {},
          pairs: {},
          messages: {},
          links: {},
          notifications: [],
        }),
    }),
    { name: "dream-board-v1" }
  )
);

// --- selectors / derived ---------------------------------------------------

export function useMe() {
  return useStore((s) => (s.meId ? s.participants[s.meId] : null));
}

export function usePartner() {
  return useStore((s) => {
    if (!s.meId) return null;
    const pair = Object.values(s.pairs).find(
      (p) => p.participantA === s.meId || p.participantB === s.meId
    );
    if (!pair) return null;
    const pid = pair.participantA === s.meId ? pair.participantB : pair.participantA;
    return s.participants[pid] ?? null;
  });
}

export function useMyPair() {
  return useStore((s) => {
    if (!s.meId) return null;
    return (
      Object.values(s.pairs).find(
        (p) => p.participantA === s.meId || p.participantB === s.meId
      ) ?? null
    );
  });
}
