"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "aperture-scribblebox";
const MIN_W = 240;
const MIN_H = 180;

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

type InteractionMode =
  | null
  | "drag"
  | "resize-n"
  | "resize-s"
  | "resize-e"
  | "resize-w"
  | "resize-ne"
  | "resize-nw"
  | "resize-se"
  | "resize-sw";

export default function Scribblebox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 320, h: 260 });
  const [posInitialised, setPosInitialised] = useState(false);

  const mode = useRef<InteractionMode>(null);
  const startMouse = useRef({ x: 0, y: 0 });
  const startRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Load persisted text on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
    setLoaded(true);
  }, []);

  // Set initial position once open
  useEffect(() => {
    if (open && !posInitialised) {
      setPos({
        x: window.innerWidth - size.w - 60,
        y: window.innerHeight - size.h - 80,
      });
      setPosInitialised(true);
    }
  }, [open, posInitialised, size.w, size.h]);

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

  // Start drag
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      mode.current = "drag";
      startMouse.current = { x: e.clientX, y: e.clientY };
      startRect.current = { x: pos.x, y: pos.y, w: size.w, h: size.h };
      e.preventDefault();
    },
    [pos, size]
  );

  // Start resize
  const onResizeStart = useCallback(
    (edge: InteractionMode) => (e: React.MouseEvent) => {
      mode.current = edge;
      startMouse.current = { x: e.clientX, y: e.clientY };
      startRect.current = { x: pos.x, y: pos.y, w: size.w, h: size.h };
      e.preventDefault();
      e.stopPropagation();
    },
    [pos, size]
  );

  // Unified mousemove / mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!mode.current) return;
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      const r = startRect.current;

      if (mode.current === "drag") {
        setPos({ x: r.x + dx, y: r.y + dy });
        return;
      }

      let newX = r.x;
      let newY = r.y;
      let newW = r.w;
      let newH = r.h;

      const m = mode.current;

      if (m.includes("e")) newW = Math.max(MIN_W, r.w + dx);
      if (m.includes("s")) newH = Math.max(MIN_H, r.h + dy);
      if (m.includes("w")) {
        const proposedW = r.w - dx;
        if (proposedW >= MIN_W) {
          newW = proposedW;
          newX = r.x + dx;
        }
      }
      if (m.includes("n")) {
        const proposedH = r.h - dy;
        if (proposedH >= MIN_H) {
          newH = proposedH;
          newY = r.y + dy;
        }
      }

      setPos({ x: newX, y: newY });
      setSize({ w: newW, h: newH });
    };

    const onMouseUp = () => {
      mode.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const edge = "absolute bg-transparent z-10";
  const GRIP = 6;

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
          style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
          className="fixed z-50 rounded-2xl border border-forest/20 bg-white/95 backdrop-blur-md shadow-xl flex flex-col overflow-hidden"
        >
          {/* Resize handles — edges */}
          <div onMouseDown={onResizeStart("resize-n")} className={`${edge} top-0 left-[${GRIP}px] right-[${GRIP}px] h-[${GRIP}px] cursor-n-resize`} style={{ top: 0, left: GRIP, right: GRIP, height: GRIP, cursor: "n-resize" }} />
          <div onMouseDown={onResizeStart("resize-s")} className={edge} style={{ bottom: 0, left: GRIP, right: GRIP, height: GRIP, cursor: "s-resize" }} />
          <div onMouseDown={onResizeStart("resize-w")} className={edge} style={{ left: 0, top: GRIP, bottom: GRIP, width: GRIP, cursor: "w-resize" }} />
          <div onMouseDown={onResizeStart("resize-e")} className={edge} style={{ right: 0, top: GRIP, bottom: GRIP, width: GRIP, cursor: "e-resize" }} />

          {/* Resize handles — corners */}
          <div onMouseDown={onResizeStart("resize-nw")} className={edge} style={{ top: 0, left: 0, width: GRIP * 2, height: GRIP * 2, cursor: "nw-resize" }} />
          <div onMouseDown={onResizeStart("resize-ne")} className={edge} style={{ top: 0, right: 0, width: GRIP * 2, height: GRIP * 2, cursor: "ne-resize" }} />
          <div onMouseDown={onResizeStart("resize-sw")} className={edge} style={{ bottom: 0, left: 0, width: GRIP * 2, height: GRIP * 2, cursor: "sw-resize" }} />
          <div onMouseDown={onResizeStart("resize-se")} className={edge} style={{ bottom: 0, right: 0, width: GRIP * 2, height: GRIP * 2, cursor: "se-resize" }} />

          {/* Drag handle / header */}
          <div
            onMouseDown={onDragStart}
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
            className="flex-1 px-4 py-3 text-sm text-black bg-transparent resize-none focus:outline-none placeholder:text-black/25 placeholder:italic"
          />
        </div>
      )}
    </>
  );
}
