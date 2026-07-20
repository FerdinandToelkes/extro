export default function Avatar({ profile, size = 32 }) {
  if (!profile) return null;
  const initials =
    profile.avatar_initials || (profile.name || "?").slice(0, 2).toUpperCase();
  return (
    <div
      title={profile.name}
      className="rounded-full flex items-center justify-center font-display font-semibold border-2 border-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "#E7E5F5",
        color: "#4B4ECF",
        boxShadow: "0 0 0 1px #E2E0D8",
      }}
    >
      {initials}
    </div>
  );
}
