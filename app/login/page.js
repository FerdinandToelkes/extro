"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { name: name || email.split("@")[0] },
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-8">
        <h1 className="font-display font-bold text-2xl mb-1">Aktivitäten-Feed</h1>
        <p className="text-inksoft text-sm mb-6 font-body">
          Melde dich mit deiner E-Mail an – du bekommst einen Login-Link, kein Passwort nötig.
        </p>
        {sent ? (
          <p className="font-body text-sm text-sage">
            Link verschickt! Schau in dein Postfach ({email}) und klick auf den Link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Dein Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
            <input
              type="email"
              required
              placeholder="deine@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
            <button
              type="submit"
              className="bg-ink text-white font-display font-semibold rounded-full px-4 py-2 text-sm mt-2"
            >
              Login-Link senden
            </button>
            {error && <p className="text-coral text-xs font-body">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
