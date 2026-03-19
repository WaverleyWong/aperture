"use client";

import { useState, useCallback } from "react";

interface ComponentCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => Promise<void> | void;
}

export default function ComponentCard({ title, children, className = "", onRefresh }: ComponentCardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleTitleClick = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        // Placeholder components: just show the animation briefly
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  return (
    <div
      className={`rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-5 flex flex-col overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)] ${className}`}
    >
      <button
        type="button"
        onClick={handleTitleClick}
        className="flex items-center gap-2 mb-4 text-left cursor-pointer group"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest group-hover:text-forest/70 transition-colors">
          {title}
        </h2>
        <span
          className={`transition-opacity duration-200 ${refreshing ? "opacity-100" : "opacity-0"}`}
        >
          <svg
            className="w-3 h-3 animate-spin text-forest/40"
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
        </span>
      </button>
      <div
        className={`flex-1 flex flex-col transition-opacity duration-300 ${refreshing ? "opacity-30" : "opacity-100"}`}
      >
        {children}
      </div>
    </div>
  );
}
