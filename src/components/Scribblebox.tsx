"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STATE_KEY = "scribblebox";
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

function PenIcon() {
  return (
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
  );
}

export default function Scribblebox() {
  const [popupOpen, setPopupOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 320, h: 260 });
  const [posInitialised, setPosInitialised] = useState(false);

  const mode = useRef<InteractionMode>(null);
  const startMouse = useRef({ x: 0, y: 0 });
  const startRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Turso on mount
  useEffect(() => {
    fetch(`/api/state?key=${STATE_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value) setText(data.value);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Set initial popup position once open
  useEffect(() => {
    if (popupOpen && !posInitialised) {
      setPos({
        x: window.innerWidth - size.w - 60,
        y: window.innerHeight - size.h - 80,
      });
      setPosInitialised(true);
    }
  }, [popupOpen, posInitialised, size.w, size.h]);

  // Debounced save to Turso on change
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STATE_KEY, value: text }),
      }).catch(() => {});
    }, 500);
  }, [text, loaded]);

  // Focus fullscreen textarea when opening
  useEffect(() => {
    if (fullscreenOpen && fullscreenTextareaRef.current) {
      const ta = fullscreenTextareaRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [fullscreenOpen]);

  const handleClear = () => {
    setText("");
    fetch("/api/state?key=" + STATE_KEY, { method: "DELETE" }).catch(() => {});
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
      {/* ── Taskbar: fixed bottom-center tab ── */}
      {!fullscreenOpen && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-end">
          <button
            onClick={() => {
              setFullscreenOpen(true);
              setPopupOpen(false);
            }}
            className="group flex items-center justify-center gap-2 w-[160px] py-2 bg-forest/90 hover:bg-forest text-white rounded-t-xl backdrop-blur-sm shadow-lg transition-all"
          >
            <PenIcon />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80 group-hover:opacity-100 transition-opacity">
              Scribblebox
            </span>
          </button>
        </div>
      )}

      {/* ── Floating trigger button (bottom-right, for quick popup) ── */}
      {!fullscreenOpen && (
        <button
          onClick={() => setPopupOpen((v) => !v)}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-forest text-white shadow-lg hover:bg-forest/90 transition-colors flex items-center justify-center"
          aria-label="Open Scribblebox"
        >
          <PenIcon />
        </button>
      )}

      {/* ── Popup (small floating window) ── */}
      {popupOpen && !fullscreenOpen && (
        <div
          style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
          className="fixed z-50 rounded-2xl border border-forest/20 bg-white/95 backdrop-blur-md shadow-xl flex flex-col overflow-hidden"
        >
          {/* Resize handles — edges */}
          <div onMouseDown={onResizeStart("resize-n")} className={edge} style={{ top: 0, left: GRIP, right: GRIP, height: GRIP, cursor: "n-resize" }} />
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
                onClick={() => setPopupOpen(false)}
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

      {/* ── Full-screen writing overlay ── */}
      {fullscreenOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#FAF5EC]">
          {/* Header */}
          <div className="flex items-center justify-between px-10 py-6 shrink-0">
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-forest">
              Scribblebox
            </h1>
            <div className="flex items-center gap-4">
              {text.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-[10px] uppercase tracking-wider text-black/30 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setFullscreenOpen(false)}
                className="flex items-center gap-1.5 text-black/30 hover:text-black/60 transition-colors"
                aria-label="Close full-screen"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span className="text-[10px] uppercase tracking-wider font-medium">Close</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-10 border-t border-forest/[0.08]" />

          {/* Writing area */}
          <div className="flex-1 flex justify-center overflow-hidden px-10 py-8">
            <textarea
              ref={fullscreenTextareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={dailyPlaceholder()}
              className="w-full max-w-3xl text-base leading-relaxed text-black bg-transparent resize-none focus:outline-none placeholder:text-black/20 placeholder:italic"
            />
          </div>

          {/* Bottom taskbar — return to dashboard */}
          <div className="shrink-0 flex justify-center pb-0">
            <button
              onClick={() => setFullscreenOpen(false)}
              className="group flex items-center justify-center gap-2 w-[160px] py-2 bg-forest/90 hover:bg-forest text-white rounded-t-xl backdrop-blur-sm shadow-lg transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80 group-hover:opacity-100 transition-opacity">
                Dashboard
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
