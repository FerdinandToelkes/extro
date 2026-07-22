"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  // "checking" while we detect the recovery session, then "ready" or "invalid".
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // supabase-js parses the recovery token from the URL on load and emits a
    // session. Check for one, and also listen in case it arrives a beat later.
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) setStatus("ready");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });
    // If no session showed up shortly after load, treat the link as invalid.
    const timer = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 2500);
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
