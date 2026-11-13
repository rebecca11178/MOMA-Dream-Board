import { useMemo, useState } from "react";
import { QUIZ, winningIndex } from "../lib/personality";
import { POP_PALETTE, resolveColor, colorDisplayName } from "../config/palette";
import { useStore } from "../lib/store";
import Blob from "./Blob";

type Phase = "intro" | "quiz" | "code" | "reveal";

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding);
  const [phase, setPhase] = useState<Phase>("intro");
  const [qi, setQi] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [serial, setSerial] = useState("");

  const familyIndex = useMemo(() => winningIndex(picks), [picks]);
  const family = POP_PALETTE[familyIndex];
  const hex = useMemo(
    () => resolveColor(family, serial.padEnd(6, "0")),
    [family, serial]
  );

  function pick(optionId: string) {
    setPicks((prev) => {
      const next = [...prev];
      next[qi] = optionId;
      return next;
    });
    setTimeout(() => {
      if (qi < QUIZ.length - 1) setQi(qi + 1);
      else setPhase("code");
    }, 160);
  }

  function pressKey(d: string) {
    setSerial((s) => (s.length >= 6 ? s : s + d));
  }
  function del() {
    setSerial((s) => s.slice(0, -1));
  }

  // --- INTRO ---
  if (phase === "intro") {
    return (
      <div className="screen">
        <div className="spacer" />
        <div style={{ display: "grid", placeItems: "center", marginBottom: 20 }}>
          <Blob colorA="#FF4D2E" colorB="#2D9CDB" blendRatio={0.2} mood={5} size={200} />
        </div>
        <span className="eyebrow">The Dream Board</span>
        <h1>Raise a tiny creature with a stranger.</h1>
        <p>
          You'll be paired with someone you've never met. Each day you both feed
          your pet a feeling and one line about your day. It quietly notices when
          two people, anywhere, feel the same thing.
        </p>
        <div className="spacer" />
        <button className="btn" onClick={() => setPhase("quiz")}>
          Find my color
        </button>
      </div>
    );
  }

  // --- QUIZ ---
  if (phase === "quiz") {
    const q = QUIZ[qi];
    return (
      <div className="screen">
        <div className="progress">
          <i style={{ width: `${((qi + 1) / QUIZ.length) * 100}%` }} />
        </div>
        <span className="eyebrow">
          Question {qi + 1} of {QUIZ.length}
        </span>
        <h1 style={{ marginBottom: 18 }}>{q.prompt}</h1>
        {q.options.map((o) => (
          <button
            key={o.id}
            className={`option ${picks[qi] === o.id ? "sel" : ""}`}
            onClick={() => pick(o.id)}
          >
            {o.text}
          </button>
        ))}
        <div className="spacer" />
        {qi > 0 && (
          <button className="btn btn-ghost" onClick={() => setQi(qi - 1)}>
            Back
          </button>
        )}
      </div>
    );
  }

  // --- CODE ---
  if (phase === "code") {
    return (
      <div className="screen">
        <span className="eyebrow">Almost there</span>
        <h1>Enter your 6-digit code.</h1>
        <p>
          This is on your invite card. It makes your color one of a kind — no two
          people get exactly the same shade.
        </p>
        <div className="code-dots">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={serial.length > i ? "on" : ""} />
          ))}
        </div>
        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => pressKey(d)}>
              {d}
            </button>
          ))}
          <button onClick={del}>⌫</button>
          <button onClick={() => pressKey("0")}>0</button>
          <button
            style={{ color: serial.length === 6 ? "var(--accent)" : "var(--text-dim)" }}
            disabled={serial.length !== 6}
            onClick={() => serial.length === 6 && setPhase("reveal")}
          >
            →
          </button>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-ghost"
          onClick={() => {
            setSerial(String(Math.floor(100000 + Math.random() * 900000)));
          }}
        >
          I don't have a code — give me one
        </button>
      </div>
    );
  }

  // --- REVEAL ---
  return (
    <div className="screen">
      <div className="spacer" />
      <div style={{ display: "grid", placeItems: "center", marginBottom: 18, animation: "pop 0.5s ease" }}>
        <Blob colorA={hex} mood={5} size={220} />
      </div>
      <span className="eyebrow">Your color</span>
      <h1 style={{ color: hex }}>{colorDisplayName(family, serial)}</h1>
      <p>{family.tagline}</p>
      <div className="spacer" />
      <button
        className="btn"
        style={{ background: hex, color: "#17131f" }}
        onClick={() => complete("You", picks, serial, familyIndex)}
      >
        Meet my pet
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setPhase("code")}>
        Back
      </button>
    </div>
  );
}
