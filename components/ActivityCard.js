"use client";

import { useState } from "react";
import Avatar from "./Avatar";

const TIMEFRAME_COLOR = {
  Today: "#FF7A59",
  Tomorrow: "#E8A33D",
  Weekend: "#4B4ECF",
};

export default function ActivityCard({
  activity,
  profilesById,
  circlesById,
  meId,
  onJoin,
  onSendMessage,
  onEdit,
  onDelete,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const color = TIMEFRAME_COLOR[activity.timeframe] || "#4B4ECF";
  const hasJoined = activity.joined.includes(meId);
  const chatActive = activity.joined.length >= 2;
  const author = profilesById[activity.authorId];
  const isMine = activity.authorId === meId;

  const visibilityLabel = activity.visibleCircleIds.length
    ? "Visible to: " +
      activity.visibleCircleIds
        .map((id) => circlesById[id]?.name)
        .filter(Boolean)
        .join(", ")
    : activity.visiblePeopleIds.length
    ? "Visible to: " +
      activity.visiblePeopleIds
        .map((id) => profilesById[id]?.name)
        .filter(Boolean)
        .join(", ")
    : "Visible only to you";

  return (
    <div className="relative bg-white border border-border rounded-2xl rounded-tr-none rounded-bl-sm p-5 pb-4 mb-3.5 overflow-hidden">
      <div
        className="absolute top-0 right-0 w-0 h-0"
        style={{
          borderStyle: "solid",
          borderWidth: "0 26px 26px 0",
          borderColor: `transparent ${color}CC transparent transparent`,
        }}
      />
      <div className="flex gap-2.5 items-start">
        {author && <Avatar profile={author} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display font-semibold text-ink">
              {author?.name || "…"}
            </span>
            <span className="font-mono text-[11px] text-inksoft bg-bg border border-border rounded-full px-2 py-0.5">
              {activity.category}
            </span>
            <span
              className="font-mono text-[11px] font-semibold rounded-full px-2 py-0.5"
              style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
            >
              {activity.timeframe}
            </span>
            {isMine && (
              <span className="ml-auto flex gap-1.5">
                <button
                  onClick={() => onEdit(activity)}
                  className="font-mono text-[11px] text-inksoft border border-border rounded-full px-2.5 py-0.5 hover:bg-bg"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Delete this activity? This also removes its chat and can't be undone.")) {
                      onDelete(activity.id);
                    }
                  }}
                  className="font-mono text-[11px] text-coral border border-coral/40 rounded-full px-2.5 py-0.5 hover:bg-coral/10"
                >
                  Delete
                </button>
              </span>
            )}
          </div>

          <p className="font-body text-[15.5px] text-ink my-1.5 leading-snug">
            {activity.text}
          </p>

          {activity.location && (
            <div className="font-mono text-[11.5px] text-inksoft mb-1">
              📍 {activity.location}
            </div>
          )}

          <div className="font-mono text-[11px] text-gray-400 mb-1">
            {visibilityLabel}
          </div>

          {activity.expiresAt && (
            <div className="font-mono text-[11px] text-gray-400 mb-3">
              Auto-deletes{" "}
              {new Date(activity.expiresAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
          )}

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex mr-1">
              {activity.joined.map((uid, i) =>
                profilesById[uid] ? (
                  <div key={uid} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Avatar profile={profilesById[uid]} size={26} />
                  </div>
                ) : null
              )}
            </div>
            <span className="font-mono text-xs text-inksoft">
              {activity.joined.length} joined
            </span>

            <button
              onClick={() => onJoin(activity.id, hasJoined)}
              className={`ml-auto font-display font-semibold text-[13.5px] px-4 py-1.5 rounded-full ${
                hasJoined ? "bg-gray-100 text-inksoft" : "bg-indigo text-white"
              }`}
            >
              {hasJoined ? "Joined ✓" : "I'm in"}
            </button>

            {chatActive && (
              <button
                onClick={() => setChatOpen((o) => !o)}
                className="font-display font-semibold text-[13.5px] px-3.5 py-1.5 rounded-full border border-sage/40 bg-sage/10 text-sage-700"
                style={{ color: "#4C7A55" }}
              >
                💬 Chat
              </button>
            )}
          </div>

          {chatActive && chatOpen && (
            <div className="mt-3.5 border-t border-dashed border-border pt-3">
              <div className="font-mono text-[10.5px] text-sage uppercase tracking-wide mb-2">
                Temporary chat for this activity (clears after the activity ends)
              </div>
              <div className="flex flex-col gap-1.5 mb-2.5 max-h-40 overflow-y-auto">
                {activity.chat.length === 0 && (
                  <div className="text-[13px] text-gray-400 italic">
                    No messages yet — say hi!
                  </div>
                )}
                {activity.chat.map((m) => (
                  <div key={m.id} className="text-[13.5px] text-ink">
                    <b className="font-display">{profilesById[m.author_id]?.name}:</b>{" "}
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      onSendMessage(activity.id, draft.trim());
                      setDraft("");
                    }
                  }}
                  placeholder="Write a message…"
                  className="flex-1 px-3 py-2 rounded-full border border-border font-body text-[13.5px] outline-none"
                />
                <button
                  onClick={() => {
                    if (draft.trim()) {
                      onSendMessage(activity.id, draft.trim());
                      setDraft("");
                    }
                  }}
                  className="px-3.5 py-2 rounded-full bg-ink text-white font-display font-semibold text-[13px]"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
