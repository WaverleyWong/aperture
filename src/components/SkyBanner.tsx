"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

// Dispatch a custom event that all components listen for
function refreshAll() {
  window.dispatchEvent(new Event("aperture-refresh-all"));
}

export default function SkyBanner({ children }: { children: React.ReactNode }) {
  const [hour, setHour] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh state (mobile)
  const [pullProgress, setPullProgress] = useState(0);
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    document.documentElement.style.backgroundColor = themeColor;
    document.body.style.backgroundColor = themeColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColor);
  }, [themeColor]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    refreshAll();
    // Brief delay so spinner is visible
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, [refreshing]);

  // Pull-to-refresh touch handlers (mobile)
  const PULL_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) {
      setPullProgress(Math.min(dy, PULL_THRESHOLD * 1.5));
    } else {
      setPullProgress(0);
    }
  }, [pulling]);

  const handleTouchEnd = useCallback(() => {
    if (pullProgress >= PULL_THRESHOLD) {
      handleRefresh();
    }
    setPullProgress(0);
    setPulling(false);
  }, [pullProgress, handleRefresh]);

  const pullRatio = Math.min(pullProgress / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="min-h-screen"
      style={bgStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator (mobile) */}
      {pullProgress > 0 && (
        <div
          className="flex justify-center pt-2 overflow-hidden"
          style={{ height: pullProgress * 0.5 }}
        >
          <svg
            className={`w-5 h-5 ${dark ? "text-white/40" : "text-forest/40"}`}
            viewBox="0 0 16 16"
            fill="none"
            style={{
              transform: `rotate(${pullRatio * 360}deg)`,
              opacity: pullRatio,
            }}
          >
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset={28 - pullRatio * 20} strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Page content */}
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className={`text-lg font-semibold tracking-tight transition-colors duration-1000 ${
                dark ? "text-white/80" : "text-forest"
              }`}
            >
              Aperture
            </h1>
            {/* Refresh button — desktop */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`hidden md:flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                dark
                  ? "text-white/30 hover:text-white/60 hover:bg-white/10"
                  : "text-forest/30 hover:text-forest/60 hover:bg-forest/10"
              }`}
              aria-label="Refresh all"
              title="Refresh all components"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
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
