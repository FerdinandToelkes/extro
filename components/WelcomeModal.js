"use client";

import { useState } from "react";

const STEPS = [
  {
    emoji: "💭",
    title: "Share what you're in the mood for",
    body: "Extro is a feed of lightweight intentions, not a calendar of formal events. Post things like “up for a walk this afternoon” or “anyone for boardgames Saturday?” — no pressure, no RSVPs.",
  },
  {
    emoji: "👀",
    title: "You choose who sees each post",
    body: "Every activity is shared with everyone you're friends with (the default), a specific Friend Circle, or just a few individual people. Nothing is ever public.",
  },
  {
    emoji: "○",
    title: "Circles are mutual-friend groups",
    body: "A circle (e.g. “Climbing crew”) is a reusable audience where everyone is friends with everyone else. Create them on the Circles page — Extro even suggests circles from friends who all know each other.",
  },
  {
    emoji: "🗓",
    title: "Share when you're free",
    body: "On the Calendar page you can mark when you're generally free each day of the week, and see when your friends are around — each slot visible only to the circles or people you pick.",
  },
  {
    emoji: "✋",
    title: "Respond & make a plan",
    body: "Tap I'm in, Interested, or Mayhaps on anyone's post. Once a couple of people respond, a temporary activity chat opens so you can sort out the details — it clears when the activity ends.",
  },
];

export default function WelcomeModal({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 font-mono text-lg leading-none text-gray-400 hover:text-inksoft"
          aria-label="Skip tutorial"
        >
          ×
        </button>

        <div className="text-4xl mb-3">{s.emoji}</div>
        <h2 className="font-display font-bold text-xl text-ink mb-2">{s.title}</h2>
        <p className="font-body text-[14.5px] text-inksoft leading-snug mb-5">{s.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-indigo" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((n) => n - 1)}
              className="font-display font-semibold text-sm px-4 py-2 rounded-full border border-border bg-white text-inksoft"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="font-mono text-[12px] text-gray-400 px-2 py-2"
            >
              Skip
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStep((n) => n + 1))}
            className="font-display font-semibold text-sm px-5 py-2 rounded-full bg-ink text-white"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
