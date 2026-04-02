"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string };

const MIN_W = 340;
const MIN_H = 400;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Desktop drag/resize state
  const [pos, setPos] = useState({ x: 24, y: 0 });
  const [size, setSize] = useState({ w: 380, h: 500 });
  const [isMobile, setIsMobile] = useState(false);
  const interactionRef = useRef<null | "drag" | string>(null);
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Set initial position (bottom-left, above the chat button)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPos({ x: 24, y: window.innerHeight - 500 - 80 });
    }
  }, []);

  // Load today's conversation on mount
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          setMessages(data.messages);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Request opening message on first open if no messages
  useEffect(() => {
    if (open && loaded && messages.length === 0 && !loading) {
      setLoading(true);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestOpening: true }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.content) {
            setMessages([{ role: "assistant", content: data.content }]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, loaded, messages.length, loading]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Desktop drag/resize handlers ──

  const handlePointerDown = (
    e: React.PointerEvent,
    mode: "drag" | string
  ) => {
    if (isMobile) return;
    e.preventDefault();
    interactionRef.current = mode;
    dragStart.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, w: size.w, h: size.h };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const mode = interactionRef.current;
    if (!mode) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;

    if (mode === "drag") {
      setPos({
        x: dragStart.current.x + dx,
        y: dragStart.current.y + dy,
      });
    } else if (mode === "resize-se") {
      setSize({
        w: Math.max(MIN_W, dragStart.current.w + dx),
        h: Math.max(MIN_H, dragStart.current.h + dy),
      });
    } else if (mode === "resize-e") {
      setSize((s) => ({ ...s, w: Math.max(MIN_W, dragStart.current.w + dx) }));
    } else if (mode === "resize-s") {
      setSize((s) => ({ ...s, h: Math.max(MIN_H, dragStart.current.h + dy) }));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    interactionRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  // ── Chat bubble button ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-11 h-11 rounded-full bg-forest text-white shadow-lg hover:bg-forest/90 transition-colors flex items-center justify-center anim-tap"
        aria-label="Open chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  // ── Mobile: full-screen overlay ──
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#FAF5EC]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-forest/10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">
            Assistant
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-black/30 hover:text-black/60 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-none">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {loading && <TypingIndicator />}
        </div>

        {/* Input */}
        <div className="border-t border-forest/10 px-4 py-3 bg-white/50 backdrop-blur-sm">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 text-sm bg-transparent border border-forest/10 rounded-xl py-2 px-3 placeholder:text-black/25 focus:outline-none focus:border-cerulean transition-colors resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-3 py-2 rounded-xl bg-forest text-white text-sm font-medium disabled:opacity-30 transition-opacity anim-tap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: draggable/resizable window ──
  return (
    <div
      className="fixed z-[60] rounded-2xl border border-forest/20 bg-white/95 backdrop-blur-md shadow-xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-forest/10 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={(e) => handlePointerDown(e, "drag")}
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">
          Assistant
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="text-black/30 hover:text-black/60 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 component-scroll">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t border-forest/10 px-3 py-2.5 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 text-sm bg-transparent border border-forest/10 rounded-xl py-2 px-3 placeholder:text-black/25 focus:outline-none focus:border-cerulean transition-colors resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-xl bg-forest text-white text-sm font-medium disabled:opacity-30 transition-opacity anim-tap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Resize handles */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onPointerDown={(e) => handlePointerDown(e, "resize-se")}
      />
      <div
        className="absolute bottom-0 left-0 right-4 h-1.5 cursor-s-resize"
        onPointerDown={(e) => handlePointerDown(e, "resize-s")}
      />
      <div
        className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize"
        onPointerDown={(e) => handlePointerDown(e, "resize-e")}
      />
    </div>
  );
}

// ── Sub-components ──

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-forest text-white rounded-br-md"
            : "bg-forest/[0.06] text-black/80 rounded-bl-md"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-forest/[0.06] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
