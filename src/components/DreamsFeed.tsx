import { useEffect } from "react";
import { useStore } from "../lib/store";
import type { NotificationKind } from "../lib/types";

const ICON: Record<NotificationKind, string> = {
  reply: "🫧",
  partner_link: "🔗",
  stranger_link: "✨",
  theme: "🏷️",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DreamsFeed() {
  const notifications = useStore((s) => s.notifications);
  const markAllRead = useStore((s) => s.markAllRead);

  useEffect(() => {
    const t = setTimeout(markAllRead, 1200);
    return () => clearTimeout(t);
  }, [notifications.length, markAllRead]);

  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ paddingBottom: 90 }}>
      <span className="eyebrow">Dreams</span>
      <h1 style={{ marginBottom: 14 }}>What your pet felt</h1>
      {sorted.length === 0 && (
        <p>Nothing yet. Feed your pet to hear back from it.</p>
      )}
      {sorted.map((n) => (
        <div key={n.id} className={`notif ${n.read ? "" : "unread"}`}>
          <span className="ico">{ICON[n.kind]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ lineHeight: 1.45 }}>{n.body}</div>
            <small>{timeAgo(n.createdAt)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
