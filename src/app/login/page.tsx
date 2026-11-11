"use client";

import { useState } from "react";

/**
 * Where to go after a correct passcode. Read from the query string at submit
 * time rather than with useSearchParams, which would force this page into a
 * Suspense boundary. Only same-origin paths are accepted.
 */
function destination(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !passcode) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        // Full navigation, so the server renders with the new cookie.
        window.location.replace(destination());
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      setPasscode("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(180deg, #FFF8E8 0%, #F3FEFF 100%)" }}
    >
      <div className="anim-fade-in w-full max-w-sm rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-semibold tracking-tight text-forest">Aperture</h1>
        <h2 className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-forest">
          Passcode
        </h2>

        <form onSubmit={handleSubmit} className="mt-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            disabled={submitting}
            aria-label="Passcode"
            className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-black placeholder:text-black/25 outline-none focus:border-cerulean/60 focus:ring-2 focus:ring-cerulean/15 disabled:opacity-50 transition-colors"
          />

          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !passcode}
            className="anim-tap mt-5 w-full text-sm font-medium bg-cerulean text-white py-2.5 px-4 rounded-xl hover:bg-cerulean/90 disabled:bg-black/10 disabled:text-black/30 transition-colors"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
