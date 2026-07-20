import Avatar from "./Avatar";

export default function OverlapBanner({ group, profilesById, onMerge }) {
  const authorIds = [...new Set(group.map((a) => a.authorId))];
  return (
    <div className="bg-indigo/5 border-[1.5px] border-dashed border-indigo/40 rounded-2xl p-4 mb-3.5 flex items-center gap-3.5 flex-wrap">
      <div className="flex">
        {authorIds.map((uid, i) =>
          profilesById[uid] ? (
            <div key={uid} style={{ marginLeft: i === 0 ? 0 : -10 }}>
              <Avatar profile={profilesById[uid]} size={30} />
            </div>
          ) : null
        )}
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="font-display font-semibold text-sm text-ink">
          Überschneidung erkannt
        </div>
        <div className="font-body text-[13px] text-inksoft">
          {authorIds.map((id) => profilesById[id]?.name).join(" & ")} haben beide Lust
          auf <b>{group[0].category}</b> · {group[0].timeframe}. Zusammenlegen?
        </div>
      </div>
      <button
        onClick={() => onMerge(group)}
        className="font-display font-semibold text-[13px] px-4 py-1.5 rounded-full bg-indigo text-white"
      >
        Zusammenlegen
      </button>
    </div>
  );
}
