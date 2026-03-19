"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "aperture-scribblebox";

const placeholders = [
  "What're you thinking?",
  "Note to self...",
  "Quick thought...",
  "Jot it down...",
  "Brain dump...",
  "Don't forget...",
  "Spark of an idea...",
];

function dailyPlaceholder(): string {
  const today = new Date();
  const dayIndex =
    (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) %
    placeholders.length;
  return placeholders[dayIndex];
}

export default function Scribblebox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [posInitialised, setPosInitialised] = useState(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Load persisted text on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
    setLoaded(true);
  }, []);

  // Set initial position once open and we know window size
  useEffect(() => {
    if (open && !posInitialised) {
      setPos({
        x: window.innerWidth - 380,
        y: window.innerHeight - 340,
      });
      setPosInitialised(true);
    }
  }, [open, posInitialised]);

  // Persist text on change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, text);
    }
  }, [text, loaded]);

  const handleClear = () => {
    setText("");
    localStorage.removeItem(STORAGE_KEY);
  };

  // Drag handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      e.preventDefault();
    },
    [pos]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-forest text-white shadow-lg hover:bg-forest/90 transition-colors flex items-center justify-center"
        aria-label="Open Scribblebox"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      {/* Popup */}
      {open && (
        <div
          ref={popupRef}
          style={{ left: pos.x, top: pos.y }}
          className="fixed z-50 w-[320px] rounded-2xl border border-forest/20 bg-white/95 backdrop-blur-md shadow-xl flex flex-col overflow-hidden"
        >
          {/* Drag handle / header */}
          <div
            onMouseDown={onMouseDown}
            className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none border-b border-forest/10"
          >
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">
              Scribblebox
            </h2>
            <div className="flex items-center gap-2">
              {text.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-[10px] uppercase tracking-wider text-black/30 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-black/30 hover:text-black/60 transition-colors text-sm leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dailyPlaceholder()}
            className="flex-1 min-h-[180px] px-4 py-3 text-sm text-black bg-transparent resize-none focus:outline-none placeholder:text-black/25 placeholder:italic"
          />
        </div>
      )}
    </>
  );
}
