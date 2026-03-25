"use client";

import { useEffect, useState } from "react";

function getBackgroundColor(hour: number): string {
  if (hour >= 2 && hour <= 11) return "#E6FDFF";
  if (hour > 11 && hour < 18) return "#2F9C95";
  return "#000000"; // 18:00–01:59
}

function isDarkBg(hour: number): boolean {
  return hour >= 18 || hour < 2;
}

export default function SkyBanner({ children }: { children: React.ReactNode }) {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());

    const interval = setInterval(() => {
      setHour(new Date().getHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const bg = hour !== null ? getBackgroundColor(hour) : "#E6FDFF";
  const dark = hour !== null ? isDarkBg(hour) : false;

  // Set background on html + body so overscroll areas match, and update theme-color
  useEffect(() => {
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", bg);
  }, [bg]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg }}>
      {/* Page content */}
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex items-baseline justify-between">
          <h1
            className={`text-lg font-semibold tracking-tight transition-colors duration-1000 ${
              dark ? "text-white/80" : "text-forest"
            }`}
          >
            Aperture
          </h1>
          <span
            className={`text-xs transition-colors duration-1000 ${
              dark ? "text-white/40" : "text-black/30"
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
