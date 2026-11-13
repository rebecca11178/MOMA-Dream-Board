import { useEffect, useRef, useState, useId } from "react";

// Port of the SwiftUI BlobPet body: 13 anchor points on a circle whose radius
// is modulated by idle sine flow + a permanent baseline bumpiness + a small
// personality bias, smoothed with Catmull-Rom. Supports local drag deformation
// (grab the edge and squish it) with Gaussian falloff, a two-color partner
// blend, a glow halo, and mood/scene-driven expression.

export type Scene = "neutral" | "dancing" | "heartShower" | "sulking" | "hiding";
export type Emotion = "sad" | "neutral" | "content" | "joyful" | "sleepy";

interface Props {
  colorA: string;
  colorB?: string | null;
  /** 0 = sharp 50/50 split, 1 = fully blended band. */
  blendRatio?: number;
  mood?: number; // 1..5
  scene?: Scene;
  size?: number;
  interactive?: boolean;
}

const POINTS = 13;
const VB = 200; // viewBox units

function moodToEmotion(mood: number, scene: Scene): Emotion {
  if (scene === "sulking") return "sad";
  if (scene === "dancing" || scene === "heartShower") return "joyful";
  if (mood <= 1) return "sad";
  if (mood === 2) return "sad";
  if (mood === 3) return "neutral";
  if (mood === 4) return "content";
  return "joyful";
}

function buildPath(
  phase: number,
  wobble: number,
  grabAngle: number | null,
  pull: { x: number; y: number }
): string {
  const cx = VB / 2;
  const cy = VB / 2;
  const baseR = VB * 0.38;
  const p = phase * 2 * Math.PI;
  const sigma = 0.65;
  const twoSigmaSq = 2 * sigma * sigma;

  const pts: [number, number][] = [];
  for (let i = 0; i < POINTS; i++) {
    const t = i / POINTS;
    const theta = t * 2 * Math.PI - Math.PI / 2;

    // idle flow
    const phi = i * 2.399; // golden step
    const slow = Math.sin(p * 0.7 + phi);
    const fast = Math.sin(p * 1.9 + phi * 1.7);
    const radiusVar = slow * 0.13 + fast * 0.06;

    // permanent baseline irregularity (stays "ugly-cute" even when still)
    const bump =
      Math.sin(i * 2.13 + 1.7) * 0.07 + Math.cos(i * 1.31 + 0.4) * 0.05;

    // personality bias: right & bottom bulge
    const rightBias = Math.max(0, Math.cos(theta)) * 0.05;
    const bottomBias = Math.max(0, Math.sin(theta)) * 0.07;

    const rFactor = 1 + bump + wobble * radiusVar + rightBias + bottomBias;
    const r = baseR * rFactor;

    let x = cx + Math.cos(theta) * r;
    let y = cy + Math.sin(theta) * r + Math.max(0, Math.sin(theta)) * baseR * 0.025;

    if (grabAngle !== null && (pull.x !== 0 || pull.y !== 0)) {
      let delta = theta - grabAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const falloff = Math.exp(-(delta * delta) / twoSigmaSq);
      x += pull.x * falloff;
      y += pull.y * falloff;
    }
    pts.push([x, y]);
  }

  // Catmull-Rom -> cubic bezier
  const tension = 0.2;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < POINTS; i++) {
    const p0 = pts[(i - 1 + POINTS) % POINTS];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % POINTS];
    const p3 = pts[(i + 2) % POINTS];
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(
      2
    )}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

export default function Blob({
  colorA,
  colorB,
  blendRatio = 0,
  mood = 3,
  scene = "neutral",
  size = 220,
  interactive = true,
}: Props) {
  const gid = useId().replace(/:/g, "");
  const [phase, setPhase] = useState(0);
  const [grabAngle, setGrabAngle] = useState<number | null>(null);
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  // idle animation loop (~7s period)
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPhase(((now - start) / 7000) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const wobble = 0.3 + (mood / 5) * 0.7;
  const emotion = moodToEmotion(mood, scene);

  // dancing sway / sulking damp
  const sway =
    scene === "dancing" ? Math.sin(phase * 2 * Math.PI * 2) * 8 : 0;
  const tilt =
    scene === "dancing" ? Math.sin(phase * 2 * Math.PI * 2 + Math.PI / 2) * 7 : 0;
  const effWobble = scene === "sulking" ? wobble * 0.6 : wobble;

  const bodyPath = buildPath(phase, effWobble, grabAngle, pull);
  const glowPath = buildPath(phase, effWobble * 1.05, grabAngle, pull);

  // --- drag handlers (grab the edge, squish) ---
  function toLocal(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = VB / rect.width;
    const sy = VB / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }
  function onDown(e: React.PointerEvent) {
    if (!interactive) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    const { x, y } = toLocal(e);
    setGrabAngle(Math.atan2(y - VB / 2, x - VB / 2));
    setPull({ x: 0, y: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (!interactive || !dragging.current || grabAngle === null) return;
    const { x, y } = toLocal(e);
    // vector from blob center to pointer, softly saturated
    let dx = x - (VB / 2 + Math.cos(grabAngle) * VB * 0.38);
    let dy = y - (VB / 2 + Math.sin(grabAngle) * VB * 0.38);
    const maxMag = VB * 0.42;
    const mag = Math.hypot(dx, dy) || 1;
    const limited = maxMag * Math.tanh(mag / maxMag);
    const s = limited / mag;
    setPull({ x: dx * s, y: dy * s });
  }
  function onUp() {
    dragging.current = false;
    setPull({ x: 0, y: 0 });
    setTimeout(() => setGrabAngle(null), 200);
  }

  const half = 0.004 + Math.min(1, blendRatio) * 0.46;
  const strokeDark = "#17131f";

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      style={{ touchAction: "none", overflow: "visible", cursor: interactive ? "grab" : "default" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <defs>
        <linearGradient id={`body-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {colorB ? (
            <>
              <stop offset="0" stopColor={colorA} />
              <stop offset={Math.max(0, 0.5 - half)} stopColor={colorA} />
              <stop offset={Math.min(1, 0.5 + half)} stopColor={colorB} />
              <stop offset="1" stopColor={colorB} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={colorA} />
              <stop offset="1" stopColor={colorA} />
            </>
          )}
        </linearGradient>
        <linearGradient id={`shade-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.26" />
        </linearGradient>
        <filter id={`glow-${gid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <g transform={`translate(${sway} 0) rotate(${tilt} ${VB / 2} ${VB / 2})`}>
        {/* glow halo (brighter as blend/mood rises) */}
        <path
          d={glowPath}
          fill={colorB || colorA}
          opacity={0.35 + (mood / 5) * 0.2}
          filter={`url(#glow-${gid})`}
          transform={`scale(1.12) translate(${-VB * 0.06} ${-VB * 0.06})`}
        />
        {/* body */}
        <path d={bodyPath} fill={`url(#body-${gid})`} />
        {/* depth shade */}
        <path d={bodyPath} fill={`url(#shade-${gid})`} style={{ mixBlendMode: "multiply" }} />
        {/* edge stroke */}
        <path d={bodyPath} fill="none" stroke={strokeDark} strokeOpacity="0.5" strokeWidth={VB * 0.012} />

        {scene !== "sulking" && <Face emotion={emotion} />}
        {scene === "sulking" && <SulkCloud />}
        {scene === "heartShower" && <Hearts phase={phase} />}
      </g>
    </svg>
  );
}

function Face({ emotion }: { emotion: Emotion }) {
  const stroke = "#17131f";
  const eye = (cx: number, cy: number, r: number) => {
    if (emotion === "sleepy")
      return <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={stroke} strokeWidth="4" strokeLinecap="round" />;
    if (emotion === "joyful")
      return (
        <path d={`M ${cx - r} ${cy + 2} Q ${cx} ${cy - r * 1.4} ${cx + r} ${cy + 2}`} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      );
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={stroke} />
        <circle cx={cx + r * 0.35} cy={cy - r * 0.35} r={r * 0.28} fill="#fff" fillOpacity="0.9" />
      </g>
    );
  };
  let mouth: string;
  switch (emotion) {
    case "sad":
      mouth = `M 86 128 Q 100 118 114 128`;
      break;
    case "neutral":
      mouth = `M 88 126 L 112 124`;
      break;
    case "content":
      mouth = `M 85 122 Q 100 134 115 122`;
      break;
    case "joyful":
      mouth = `M 83 120 Q 100 140 117 120`;
      break;
    default:
      mouth = `M 88 126 L 112 124`;
  }
  return (
    <g>
      {eye(88, 96, 7)}
      {eye(112, 98, 6)}
      <path d={mouth} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function SulkCloud() {
  return (
    <g>
      <ellipse cx="100" cy="36" rx="34" ry="15" fill="#7b7b86" opacity="0.8" />
      <text x="100" y="58" fontSize="20" textAnchor="middle" fill="#ffd23f">
        ⚡
      </text>
    </g>
  );
}

function Hearts({ phase }: { phase: number }) {
  return (
    <g pointerEvents="none">
      {[0, 1, 2, 3, 4].map((i) => {
        const cycle = (phase + i * 0.18) % 1;
        const x = 100 + Math.sin((phase + i) * 6) * 26;
        const y = 70 - cycle * 80;
        return (
          <text key={i} x={x} y={y} fontSize="16" textAnchor="middle" opacity={1 - cycle}>
            💗
          </text>
        );
      })}
    </g>
  );
}
