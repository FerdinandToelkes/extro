"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  // "checking" while we detect the recovery session, then "ready" or "invalid".
  const [status, setStatus] = useState("checking");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let settled = false;
    const markInvalid = (reason) => {
      if (settled) return;
      settled = true;
      setInvalidReason(reason || "");
      setStatus("invalid");
    };
    const markReady = () => {
      if (settled) return;
      settled = true;
      setStatus("ready");
    };

    // Supabase puts an explicit error on the URL (hash for implicit flow,
    // query for PKCE) when the link is expired or already used — surface it
    // immediately instead of waiting.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const urlError = hash.get("error_description") || query.get("error_description")
      || hash.get("error") || query.get("error");
    if (urlError) {
      markInvalid(urlError.replace(/\+/g, " "));
      return;
    }

    // supabase-js (detectSessionInUrl) exchanges the recovery token on load
    // and emits an event; we also poll getSession as a fallback.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) markReady();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });
    // Last-resort safety net if the token never resolves (generous, so a slow
    // network doesn't trip a false "invalid").
    const timer = setTimeout(() => markInvalid(""), 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-8">
        <h1 className="font-display font-bold text-2xl mb-1">Set a new password</h1>

        {status === "checking" && (
          <p className="text-inksoft text-sm font-body mt-2">Checking your reset link…</p>
        )}

        {status === "invalid" && (
          <>
            <p className="text-inksoft text-sm font-body mt-2">
              This reset link is invalid or has expired. Request a new one from the
              login page.
            </p>
            {invalidReason && (
              <p className="text-gray-400 text-[11px] font-mono mt-1">{invalidReason}</p>
            )}
            <Link
              href="/login"
              className="inline-block mt-4 font-mono text-[11px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
            >
              ← Back to login
            </Link>
          </>
        )}

        {status === "ready" &&
          (done ? (
            <p className="font-body text-sm text-sage mt-2">
              Password updated! Taking you to your feed…
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 mt-3">
              <input
                type="password"
                required
                minLength={6}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-ink text-white font-display font-semibold rounded-full px-4 py-2 text-sm mt-1 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Update password"}
              </button>
              {error && <p className="text-coral text-xs font-body">{error}</p>}
            </form>
          ))}
      </div>
    </div>
  );
}
