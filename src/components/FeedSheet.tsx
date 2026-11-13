import { useState } from "react";
import { useStore } from "../lib/store";
import { TUNING } from "../config/palette";
import type { Mood } from "../lib/types";

const MOODS: { v: Mood; e: string }[] = [
  { v: 1, e: "😞" },
  { v: 2, e: "😕" },
  { v: 3, e: "😐" },
  { v: 4, e: "🙂" },
  { v: 5, e: "😄" },
];

export default function FeedSheet({
  onClose,
  onFed,
}: {
  onClose: () => void;
  onFed: () => void;
}) {
  const submit = useStore((s) => s.submitMessage);
  const [mood, setMood] = useState<Mood>(3);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function feed() {
    if (!text.trim() || sending) return;
    setSending(true);
    // tiny delay so the pet feels like it "reads" the message
    setTimeout(() => {
      submit(mood, text.trim());
      setSending(false);
      onFed();
    }, 650);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 14 }}>
          <h2>Feed your pet</h2>
          <div className="spacer" />
          <button className="btn-ghost" style={{ width: "auto", padding: "8px 14px", borderRadius: 12, border: "1px solid var(--line)" }} onClick={onClose}>
            Close
          </button>
        </div>

        <span className="eyebrow">How are you, really?</span>
        <div className="mood-row">
          {MOODS.map((m) => (
            <button
              key={m.v}
              className={`mood ${mood === m.v ? "sel" : ""}`}
              onClick={() => setMood(m.v)}
            >
              {m.e}
            </button>
          ))}
        </div>

        <span className="eyebrow">One line about your day</span>
        <textarea
          value={text}
          maxLength={TUNING.maxChars}
          placeholder="Say the true thing. Your partner never sees it — only the pet reads it."
          onChange={(e) => setText(e.target.value)}
          style={{ marginTop: 8 }}
        />
        <div style={{ textAlign: "right", color: "var(--text-dim)", fontSize: 12, margin: "6px 2px 14px" }}>
          {text.length}/{TUNING.maxChars}
        </div>

        <button className="btn" disabled={!text.trim() || sending} onClick={feed}>
          {sending ? "Your pet is reading…" : "Feed"}
        </button>
      </div>
    </div>
  );
}
