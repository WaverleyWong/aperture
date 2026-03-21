"use client";

import { useState, useEffect } from "react";

const TIMEBOX_KEY = "aperture-timebox";
const SCRIBBLE_KEY = "aperture-scribblebox";

export default function DayGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "archiving" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Check if today already has a log entry
        const check = await fetch("/api/daily-log");
        const { exists } = await check.json();

        if (exists) {
          if (!cancelled) setStatus("ready");
          return;
        }

        // No entry for today — archive yesterday's state
        if (!cancelled) setStatus("archiving");

        const timeboxRaw = localStorage.getItem(TIMEBOX_KEY);
        const scribbleRaw = localStorage.getItem(SCRIBBLE_KEY);

        const timebox_entries = timeboxRaw ? JSON.parse(timeboxRaw) : [];
        const scribblebox = scribbleRaw || "";

        await fetch("/api/daily-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timebox_entries, scribblebox }),
        });

        // Clear timebox for the new day
        localStorage.removeItem(TIMEBOX_KEY);
        window.dispatchEvent(new Event("timebox-clear"));

        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("DayGate error:", err);
        // Don't block the dashboard on failure
        if (!cancelled) setStatus("ready");
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  if (status === "ready") return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="w-5 h-5 animate-spin text-forest/40"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="28"
            strokeDashoffset="8"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-sm text-forest/50">
          {status === "checking"
            ? "Checking daily log…"
            : "Archiving yesterday's session…"}
        </p>
      </div>
    </div>
  );
}
