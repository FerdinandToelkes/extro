"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { isUsernameAvailable } from "../../lib/queries";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_HINT = "3-20 characters: lowercase letters, numbers, underscore.";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("magic");
  const [authAction, setAuthAction] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const resetMessages = () => {
    setError("");
    setSent(false);
    setConfirmPending(false);
  };

  const switchMode = (m) => {
    setMode(m);
    resetMessages();
  };

  const switchAuthAction = (a) => {
    setAuthAction(a);
    resetMessages();
  };

  // Validates format, then checks availability. Returns the normalized
  // (lowercased) username on success, or null (with `error` set) on failure.
  const validateUsername = async () => {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      setError(`Username: ${USERNAME_HINT}`);
      return null;
    }
    setChecking(true);
    try {
      const available = await isUsernameAvailable(normalized);
      if (!available) {
        setError("That username is already taken.");
        return null;
      }
      return normalized;
    } finally {
      setChecking(false);
    }
  };

  const handleMagicSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    const normalizedUsername = await validateUsername();
    if (!normalizedUsername) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { name: name || email.split("@")[0], username: normalizedUsername },
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    if (authAction === "signup") {
      const normalizedUsername = await validateUsername();
      if (!normalizedUsername) return;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split("@")[0], username: normalizedUsername } },
      });
      if (error) setError(error.message);
      else if (data.session) router.replace("/");
      else setConfirmPending(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace("/");
    }
  };

  const chip = (active) =>
    `font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer ${
      active ? "border-indigo bg-indigo/10 text-indigo" : "border-border bg-white text-inksoft"
    }`;

  const usernameInput = (
    <div>
      <input
        type="text"
        required
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
      />
      <p className="text-[11px] text-gray-400 font-mono mt-1">{USERNAME_HINT}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-8">
        <h1 className="font-display font-bold text-2xl mb-1">Extro: Activities Feed</h1>
        <p className="text-inksoft text-sm mb-4 font-body">
          Sign in with a magic link (no password), or use a password if you
          prefer.
        </p>

        <div className="flex gap-2 mb-4">
          <button type="button" className={chip(mode === "magic")} onClick={() => switchMode("magic")}>
            Magic Link
          </button>
          <button type="button" className={chip(mode === "password")} onClick={() => switchMode("password")}>
            Password
          </button>
        </div>

        {mode === "magic" ? (
          sent ? (
            <p className="font-body text-sm text-sage">
              Link sent! Check your inbox ({email}) and click the link.
            </p>
          ) : (
            <form onSubmit={handleMagicSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
              />
              {usernameInput}
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
              />
              <button
                type="submit"
                disabled={checking}
                className="bg-ink text-white font-display font-semibold rounded-full px-4 py-2 text-sm mt-2 disabled:opacity-50"
              >
                {checking ? "Checking username…" : "Send Login Link"}
              </button>
              {error && <p className="text-coral text-xs font-body">{error}</p>}
            </form>
          )
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                className={chip(authAction === "login")}
                onClick={() => switchAuthAction("login")}
              >
                Log In
              </button>
              <button
                type="button"
                className={chip(authAction === "signup")}
                onClick={() => switchAuthAction("signup")}
              >
                Sign Up
              </button>
            </div>
            {confirmPending ? (
              <p className="font-body text-sm text-sage">
                Almost there — check your inbox ({email}) to confirm your
                account, then log in with your password.
              </p>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
                {authAction === "signup" && (
                  <>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
                    />
                    {usernameInput}
                  </>
                )}
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={authAction === "signup" && checking}
                  className="bg-ink text-white font-display font-semibold rounded-full px-4 py-2 text-sm mt-2 disabled:opacity-50"
                >
                  {authAction === "signup"
                    ? checking
                      ? "Checking username…"
                      : "Create Account"
                    : "Log In"}
                </button>
                {error && <p className="text-coral text-xs font-body">{error}</p>}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
