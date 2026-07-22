"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from "../lib/queries";
import { isPushSupported, getPushState, enablePush, disablePush } from "../lib/push";

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncate(text, n = 32) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

function messageFor(n) {
  const activity = n.activityText ? ` “${truncate(n.activityText)}”` : "";
  switch (n.type) {
    case "friend_request":
      return `${n.actorName} sent you a friend request`;
    case "friend_accepted":
      return `${n.actorName} accepted your friend request`;
    case "activity_response":
      return `${n.actorName} responded to your activity${activity}`;
    case "activity_message":
      return `${n.actorName} sent a message${activity ? ` in${activity}` : ""}`;
    default:
      return "New notification";
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState({ supported: false, enabled: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  const load = async () => {
    try {
      setItems(await listNotifications());
    } catch {
      // ignore transient load errors; the badge just won't update
    }
  };

  useEffect(() => {
    (async () => {
      await load();
      if (isPushSupported()) setPush(await getPushState());
    })();
    const unsub = subscribeToNotifications(() => load());
    return unsub;
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    setPushError("");
    try {
      if (push.enabled) await disablePush();
      else await enablePush();
      setPush(await getPushState());
    } catch (err) {
      setPushError(err.message || String(err));
    } finally {
      setPushBusy(false);
    }
  };

  const unread = items.filter((i) => !i.read).length;

  const handleClickItem = async (n) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      await load();
    }
    setOpen(false);
    if (n.type === "friend_request") router.push("/friends");
    else if (n.type === "friend_accepted" && n.actorId) router.push(`/profile/${n.actorId}`);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    await load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1.5 h-fit"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-coral text-white font-mono text-[10px] leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-white border border-border rounded-xl shadow-lg z-40">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="font-display font-semibold text-[13px] text-ink">
                Notifications
              </span>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="font-mono text-[10.5px] text-indigo"
                >
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="px-3 py-6 text-center font-body text-[13px] text-gray-400">
                Nothing yet.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-bg ${
                    n.read ? "" : "bg-indigo/5"
                  }`}
                >
                  <div className="font-body text-[13px] text-ink leading-snug">
                    {!n.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo mr-1.5 align-middle" />
                    )}
                    {messageFor(n)}
                  </div>
                  <div className="font-mono text-[10.5px] text-gray-400 mt-0.5">
                    {relativeTime(n.createdAt)}
                  </div>
                </button>
              ))
            )}

            {push.supported && (
              <div className="px-3 py-2.5 border-t border-border bg-bg/40">
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  className="font-mono text-[11px] text-indigo disabled:opacity-50"
                >
                  {pushBusy
                    ? "…"
                    : push.enabled
                    ? "🔕 Disable push on this device"
                    : "🔔 Enable push on this device"}
                </button>
                {pushError && (
                  <p className="font-mono text-[10.5px] text-coral mt-1">{pushError}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
