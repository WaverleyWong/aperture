"use client";

import { useEffect, useState } from "react";

type BgStyle = { backgroundColor: string } | { background: string };

function getBackgroundStyle(hour: number): BgStyle {
  if (hour >= 2 && hour <= 11) return { background: "linear-gradient(180deg, #FFF8E8 0%, #F3FEFF 100%)" };
  if (hour > 11 && hour < 18) return { background: "linear-gradient(180deg, #D3FFED 0%, #9EDCDE 100%)" };
  return { background: "linear-gradient(180deg, #112A48 0%, #000000 100%)" };
}

function getThemeColor(hour: number): string {
  if (hour >= 2 && hour <= 11) return "#FFF8E8";
  if (hour > 11 && hour < 18) return "#D3FFED";
  return "#112A48";
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

  const bgStyle = hour !== null ? getBackgroundStyle(hour) : { backgroundColor: "#E6FDFF" };
  const themeColor = hour !== null ? getThemeColor(hour) : "#E6FDFF";
  const dark = hour !== null ? isDarkBg(hour) : false;

  // Set background on html + body so overscroll areas match, and update theme-color
  useEffect(() => {
    // Use the top color for html/body overscroll areas
    document.documentElement.style.backgroundColor = themeColor;
    document.body.style.backgroundColor = themeColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColor);
  }, [themeColor]);

  return (
    <div className="min-h-screen" style={bgStyle}>
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
