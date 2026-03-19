"use client";

import { useEffect, useState } from "react";

// Each state: solid colour at top, holds through ~40%, then fades to transparent
// by midway. This avoids the rgba-over-beige muddiness.
const SKY_STATES = {
  morning: {
    color: "#f5d6b8",   // warm peach
    topOpacity: 0.5,
  },
  midday: {
    color: "#bdd9e8",   // soft sky blue
    topOpacity: 0.4,
  },
  afternoon: {
    color: "#edc08a",   // warm amber
    topOpacity: 0.5,
  },
  evening: {
    color: "#1c2440",   // deep navy
    topOpacity: 0.55,
  },
  night: {
    color: "#31263E",   // rich purple-black
    topOpacity: 0.9,
  },
} as const;

type SkyState = keyof typeof SKY_STATES;

function getSkyState(hour: number): SkyState {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

export default function SkyBanner({ children }: { children: React.ReactNode }) {
  const [sky, setSky] = useState<SkyState | null>(null);

  useEffect(() => {
    setSky(getSkyState(new Date().getHours()));

    const interval = setInterval(() => {
      setSky(getSkyState(new Date().getHours()));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const rgb = sky ? hexToRgb(SKY_STATES[sky].color) : "0,0,0";
  const topAlpha = sky ? SKY_STATES[sky].topOpacity : 0;

  // Gradient: true colour at top → holds → fades to transparent by 55%
  const gradient = sky
    ? `linear-gradient(180deg, rgba(${rgb},${topAlpha}) 0%, rgba(${rgb},${topAlpha * 0.9}) 30%, rgba(${rgb},${topAlpha * 0.5}) 60%, transparent 80%)`
    : "transparent";

  const isDark = sky === "evening" || sky === "night";

  return (
    <div className="relative min-h-screen">
      {/* Full-page gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-[4000ms] ease-in-out z-0"
        style={{ background: gradient }}
      />

      {/* Page content */}
      <div className="relative z-10 p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex items-baseline justify-between">
          <h1
            className={`text-lg font-semibold tracking-tight transition-colors duration-[4000ms] ${
              isDark ? "text-white/80" : "text-forest"
            }`}
          >
            Aperture
          </h1>
          <span
            className={`text-xs transition-colors duration-[4000ms] ${
              isDark ? "text-white/40" : "text-black/30"
            }`}
          >
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </header>

        {children}
      </div>
    </div>
  );
}
