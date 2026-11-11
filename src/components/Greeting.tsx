"use client";

import { useEffect, useState } from "react";

/**
 * The one-line note at the top of the dashboard.
 *
 * Two entry points, so a missed event can't leave the header permanently blank:
 *  - on mount, read-through only — shows today's line immediately if one has
 *    already been generated, and never generates from pre-DayGate data
 *  - on `daygate-complete`, generate for real, since the day's tasks and
 *    calendar are synced by then. A second fire means a fresh review, so
 *    regenerate instead of serving the cache.
 */
export default function Greeting({ dark }: { dark: boolean }) {
  const [greeting, setGreeting] = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = (query: string) =>
      fetch(`/api/greeting?${query}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.greeting) setGreeting(data.greeting);
        })
        .catch(() => {});

    // Anything already generated for today, straight away.
    load("cacheOnly=1");

    let hasGenerated = false;
    const onDayGateComplete = () => {
      const refresh = hasGenerated ? "1" : "0";
      hasGenerated = true;
      load(`refresh=${refresh}`);
    };

    window.addEventListener("daygate-complete", onDayGateComplete);
    return () => {
      cancelled = true;
      window.removeEventListener("daygate-complete", onDayGateComplete);
    };
  }, []);

  if (!greeting) return null;

  return (
    <div className="flex items-start gap-2 mb-4">
      <p
        className={`flex-1 text-sm italic anim-fade transition-colors duration-1000 ${
          visible
            ? dark
              ? "text-white/40"
              : "text-black/40"
            : dark
              ? "text-white/15"
              : "text-black/15"
        }`}
      >
        {visible ? greeting : "Greeting hidden"}
      </p>
      <button
        onClick={() => setVisible((v) => !v)}
        className={`shrink-0 mt-0.5 transition-colors ${
          dark
            ? "text-white/20 hover:text-white/40"
            : "text-black/20 hover:text-black/40"
        }`}
        aria-label={visible ? "Hide greeting" : "Show greeting"}
      >
        {visible ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
