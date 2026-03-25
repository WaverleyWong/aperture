"use client";

import { useRef, useState, useEffect } from "react";

interface MobileSwipePanelProps {
  panels: { key: string; label: string; content: React.ReactNode }[];
  defaultIndex?: number;
}

export default function MobileSwipePanel({ panels, defaultIndex = 0 }: MobileSwipePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  // Scroll to default panel on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el && defaultIndex > 0) {
      el.scrollTo({ left: el.clientWidth * defaultIndex, behavior: "instant" });
    }
  }, [defaultIndex]);

  // Track active panel via scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const index = Math.round(el.scrollLeft / el.clientWidth);
        setActiveIndex(index);
        ticking = false;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (index: number) => {
    containerRef.current?.scrollTo({ left: containerRef.current.clientWidth * index, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col">
      {/* Dot indicators */}
      <div className="flex justify-center gap-2 pb-3">
        {panels.map((panel, i) => (
          <button
            key={panel.key}
            onClick={() => scrollTo(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              activeIndex === i
                ? "bg-forest/50"
                : "bg-black/15"
            }`}
            aria-label={panel.label}
          />
        ))}
      </div>

      {/* Swipeable panels */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {panels.map((panel) => (
          <div
            key={panel.key}
            className="w-full flex-shrink-0 snap-center px-1"
          >
            {panel.content}
          </div>
        ))}
      </div>
    </div>
  );
}
