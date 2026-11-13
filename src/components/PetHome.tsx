import { useMemo, useState } from "react";
import { useStore, useMe, usePartner, useMyPair } from "../lib/store";
import Blob, { type Scene } from "./Blob";
import FeedSheet from "./FeedSheet";
import DreamsFeed from "./DreamsFeed";

export default function PetHome() {
  const me = useMe();
  const partner = usePartner();
  const pair = useMyPair();
  const messages = useStore((s) => s.messages);
  const links = useStore((s) => s.links);
  const notifications = useStore((s) => s.notifications);
  const reset = useStore((s) => s.reset);

  const [tab, setTab] = useState<"pet" | "dreams">("pet");
  const [sheet, setSheet] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const { lastMood, bond, scene } = useMemo(() => {
    const mine = Object.values(messages)
      .filter((m) => m.participantId === me?.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    const lastMood = mine[0]?.mood ?? 3;
    const myLinks = Object.values(links).filter((l) => {
      const a = messages[l.messageA];
      const b = messages[l.messageB];
      return a?.participantId === me?.id || b?.participantId === me?.id;
    }).length;
    const bond = Math.min(1, myLinks * 0.18 + (pair?.blendRatio ?? 0) * 0.5);
    let scene: Scene = "neutral";
    if (lastMood <= 2) scene = "sulking";
    else if (bond > 0.7 && lastMood >= 4) scene = "dancing";
    else if (bond > 0.45) scene = "heartShower";
    return { lastMood, bond, scene };
  }, [messages, links, me, pair]);

  if (!me) return null;

  const blend = pair?.blendRatio ?? 0;

  return (
    <>
      <div className="tabbar" style={{ marginTop: 10 }}>
        <button className={tab === "pet" ? "active" : ""} onClick={() => setTab("pet")}>
          Pet
        </button>
        <button className={tab === "dreams" ? "active" : ""} onClick={() => setTab("dreams")}>
          Dreams {unread > 0 && <span className="badge" style={{ marginLeft: 6 }}>{unread}</span>}
        </button>
      </div>

      <div className="screen" style={{ paddingTop: 4 }}>
        {tab === "pet" ? (
          <>
            <div className="row">
              <div>
                <span className="eyebrow">Your shared pet</span>
                <h1 style={{ marginTop: 2 }}>Blob</h1>
              </div>
              <div className="spacer" />
            </div>

            <div style={{ display: "grid", placeItems: "center", margin: "10px 0 6px" }}>
              <Blob
                colorA={me.colorHex}
                colorB={partner?.colorHex}
                blendRatio={blend}
                mood={lastMood}
                scene={scene}
                size={248}
              />
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="swatch" style={{ background: me.colorHex }} />
                <span style={{ fontWeight: 700 }}>{me.colorName}</span>
                <span style={{ color: "var(--text-dim)" }}>· you</span>
              </div>
              <div className="row">
                <span className="swatch" style={{ background: partner?.colorHex }} />
                <span style={{ fontWeight: 700 }}>{partner?.colorName}</span>
                <span style={{ color: "var(--text-dim)" }}>· {partner?.displayName}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="eyebrow">Blend</span>
                  <div className="spacer" />
                  <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                    {Math.round(blend * 100)}%
                  </span>
                </div>
                <div className="linkbar">
                  <i
                    style={{
                      width: `${Math.max(4, blend * 100)}%`,
                      background: `linear-gradient(90deg, ${me.colorHex}, ${partner?.colorHex})`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="spacer" />
            <button className="btn" onClick={() => setSheet(true)}>
              Feed your pet
            </button>
            {useStore.getState().devMode && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 10 }}
                onClick={() => {
                  if (confirm("Reset the whole prototype? (dev)")) reset();
                }}
              >
                Reset (dev)
              </button>
            )}
          </>
        ) : (
          <DreamsFeed />
        )}
      </div>

      {sheet && (
        <FeedSheet
          onClose={() => setSheet(false)}
          onFed={() => {
            setSheet(false);
            setTab("dreams");
          }}
        />
      )}
    </>
  );
}
