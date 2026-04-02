"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string };
type PendingAction = { tool: string; args: Record<string, unknown>; description: string };

const MIN_W = 340;
const MIN_H = 400;
const NAME = "Pidge";

async function gatherContext(): Promise<string> {
  const parts: string[] = [];
  const t = Date.now();

  try {
    const [calRes, taskRes, finRes, blokRes, digestRes, slackRes, stateRes, vitalsRes] = await Promise.allSettled([
      fetch(`/api/calendar?_t=${t}`),
      fetch(`/api/notion-tasks?_t=${t}`),
      fetch(`/api/finance?_t=${t}`),
      fetch(`/api/blok-metrics?_t=${t}`),
      fetch(`/api/personal-digest?_t=${t}`),
      fetch(`/api/slack-digest?_t=${t}`),
      fetch(`/api/state`),
      fetch(process.env.NEXT_PUBLIC_CALORIE_CSV_URL || ""),
    ]);

    // Calendar
    if (calRes.status === "fulfilled" && calRes.value.ok) {
      const data = await calRes.value.json();
      const events = data.events || [];
      if (events.length === 0) {
        parts.push("CALENDAR: Clear calendar today.");
      } else {
        const list = events.map((e: { time: string; label: string; source: string }) =>
          `${e.time}: ${e.label} (${e.source})`
        ).join(", ");
        parts.push(`CALENDAR: ${list}`);
      }
    }

    // Tasks
    if (taskRes.status === "fulfilled" && taskRes.value.ok) {
      const data = await taskRes.value.json();
      const items = data.tasks || [];
      if (items.length === 0) {
        parts.push("TASKS: No tasks today.");
      } else {
        const done = items.filter((t: { done: boolean }) => t.done).length;
        const labels = items.slice(0, 10).map((t: { label: string; done: boolean }) =>
          `${t.label}${t.done ? " [done]" : ""}`
        ).join(", ");
        parts.push(`TASKS: ${items.length} tasks (${done} done): ${labels}`);
      }
    }

    // Timebox (from state)
    if (stateRes.status === "fulfilled" && stateRes.value.ok) {
      const state = await stateRes.value.json();
      if (state.timebox) {
        try {
          const entries = JSON.parse(state.timebox);
          if (entries.length > 0) {
            const list = entries.map((e: { text: string; checked: boolean }) =>
              `${e.text}${e.checked ? " [done]" : ""}`
            ).join(", ");
            parts.push(`TIMEBOX: ${entries.length} entries: ${list}`);
          }
        } catch { /* ignore */ }
      }
    }

    // Finance
    if (finRes.status === "fulfilled" && finRes.value.ok) {
      const data = await finRes.value.json();
      const w = data.weekly;
      const m = data.monthly || [];
      const subs = data.subscriptions || [];
      const fp: string[] = [];
      if (w) {
        fp.push(`Groceries: £${w.groceries.monthTotal}/£${w.groceries.monthTarget} (this week £${w.groceries.thisWeek})`);
        fp.push(`Going Out: £${w.goingOut.monthTotal}/£${w.goingOut.monthTarget} (this week £${w.goingOut.thisWeek})`);
        fp.push(`Month progress: ${Math.round(w.monthProgress * 100)}%`);
      }
      for (const cat of m) {
        fp.push(`${cat.label}: £${cat.spent}/£${cat.target}`);
      }
      if (subs.length > 0) {
        const subList = subs.map((s: { name: string; charged: number | null; expected: number }) =>
          `${s.name}: ${s.charged !== null ? `£${s.charged} charged` : `£${s.expected} expected, not yet charged`}`
        ).join(", ");
        fp.push(`Subscriptions: ${subList}`);
      }
      if (fp.length > 0) parts.push(`FINANCES: ${fp.join(". ")}`);
    }

    // BLOK Metrics
    if (blokRes.status === "fulfilled" && blokRes.value.ok) {
      const data = await blokRes.value.json();
      if (data.totalSalesTY) {
        parts.push(`BLOK METRICS: Sales MTD £${data.totalSalesTY.toLocaleString()} (LY £${data.totalSalesLY.toLocaleString()}). Trials: ${data.sc90TrialsTY} (LY ${data.sc90TrialsLY}). Ad spend: £${Math.round(data.totalAdSpend)}. CAC: £${data.blendedCAC.toFixed(2)}. As of ${data.asOfDate}.`);
      }
    }

    // Personal Email Digest
    if (digestRes.status === "fulfilled" && digestRes.value.ok) {
      const data = await digestRes.value.json();
      const nr = data.needsReply || [];
      const fyi = data.fyi || [];
      const dp: string[] = [];
      if (nr.length > 0) dp.push(`${nr.length} emails needing reply: ${nr.map((e: { sender: string; subject: string }) => `${e.sender} (${e.subject})`).join(", ")}`);
      if (fyi.length > 0) dp.push(`${fyi.length} FYI emails: ${fyi.map((e: { sender: string; subject: string }) => `${e.sender} (${e.subject})`).join(", ")}`);
      if (dp.length > 0) parts.push(`PERSONAL EMAIL: ${dp.join(". ")}`);
    }

    // Slack Digest
    if (slackRes.status === "fulfilled" && slackRes.value.ok) {
      const data = await slackRes.value.json();
      const nr = data.needsResponse || [];
      const fyi = data.fyi || [];
      const sp: string[] = [];
      if (nr.length > 0) sp.push(`${nr.length} needing response: ${nr.map((s: { sender: string; summary: string }) => `${s.sender}: ${s.summary}`).join(", ")}`);
      if (fyi.length > 0) sp.push(`${fyi.length} FYI`);
      if (sp.length > 0) parts.push(`SLACK: ${sp.join(". ")}`);
    }

    // Vitals (calories + weight from CSV)
    if (vitalsRes.status === "fulfilled" && vitalsRes.value.ok) {
      const text = await vitalsRes.value.text();
      const lines = text.split("\n").filter((l: string) => l.trim());
      if (lines.length > 1) {
        const header = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
        const weightCol = header.indexOf("weight");
        const targetCol = header.indexOf("target");
        const countCol = header.indexOf("count");

        const now = new Date();
        const todayKey = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

        let todayCalories = "";
        let latestWeight = "";

        for (let i = lines.length - 1; i >= 1; i--) {
          const cols = lines[i].split(",");
          const dateRaw = cols[0]?.trim().replace(/[-/.]/g, "/");
          if (!dateRaw) continue;
          const dateParts = dateRaw.split("/");
          if (dateParts.length !== 3) continue;
          let [d, m, y] = dateParts.map(Number);
          if (y < 100) y += 2000;
          const rowKey = `${d}/${m}/${y}`;

          if (rowKey === todayKey && countCol >= 0) {
            const cal = parseFloat(cols[countCol]);
            const tgt = targetCol >= 0 ? parseFloat(cols[targetCol]) : NaN;
            if (!isNaN(cal)) todayCalories = `Today: ${Math.round(cal)} cal${!isNaN(tgt) ? ` / ${Math.round(tgt)} target` : ""}`;
          }

          if (!latestWeight && weightCol >= 0) {
            const w = parseFloat(cols[weightCol]);
            if (!isNaN(w) && w > 0) latestWeight = `Latest weight: ${w.toFixed(1)}kg`;
          }

          if (todayCalories && latestWeight) break;
        }

        const vp: string[] = [];
        if (todayCalories) vp.push(todayCalories);
        if (latestWeight) vp.push(latestWeight);
        if (vp.length > 0) parts.push(`VITALS: ${vp.join(". ")}`);
      }
    }
  } catch {
    // Best effort
  }

  return parts.length > 0 ? parts.join("\n") : "No dashboard data available.";
}

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [context, setContext] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
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

  // Gather dashboard context when chat opens
  useEffect(() => {
    if (open && !context) {
      gatherContext().then(setContext);
    }
  }, [open, context]);

  // Request opening message on first open if no messages
  useEffect(() => {
    if (open && loaded && messages.length === 0 && !loading && context) {
      setLoading(true);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestOpening: true, context }),
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
  }, [open, loaded, messages.length, loading, context]);

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

    // Refresh context on each message
    const freshContext = await gatherContext();
    setContext(freshContext);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: freshContext }),
      });
      const data = await res.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
      if (data.pendingAction) {
        setPendingAction(data.pendingAction);
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

  const handleApproveAction = useCallback(async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executeAction: { tool: action.tool, args: action.args }, context }),
      });
      const data = await res.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to execute action." }]);
    } finally {
      setLoading(false);
    }
  }, [pendingAction, context]);

  const handleRejectAction = useCallback(() => {
    setPendingAction(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "Cancelled — no changes made." }]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Desktop drag/resize handlers ──

  const handlePointerDown = (e: React.PointerEvent, mode: "drag" | string) => {
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
      setPos({ x: dragStart.current.x + dx, y: dragStart.current.y + dy });
    } else if (mode === "resize-se") {
      setSize({ w: Math.max(MIN_W, dragStart.current.w + dx), h: Math.max(MIN_H, dragStart.current.h + dy) });
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
        aria-label={`Open ${NAME}`}
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-forest/10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">{NAME}</h2>
          <button onClick={() => setOpen(false)} className="text-black/30 hover:text-black/60 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-none">
          {messages.map((msg, i) => (<MessageBubble key={i} message={msg} />))}
          {pendingAction && <ActionCard action={pendingAction} onApprove={handleApproveAction} onReject={handleRejectAction} />}
          {loading && <TypingIndicator />}
        </div>

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
            <button onClick={sendMessage} disabled={!input.trim() || loading} className="px-3 py-2 rounded-xl bg-forest text-white text-sm font-medium disabled:opacity-30 transition-opacity anim-tap">
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
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-forest/10 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={(e) => handlePointerDown(e, "drag")}
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">{NAME}</h2>
        <button onClick={() => setOpen(false)} className="text-black/30 hover:text-black/60 transition-colors" onPointerDown={(e) => e.stopPropagation()}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 component-scroll">
        {messages.map((msg, i) => (<MessageBubble key={i} message={msg} />))}
        {pendingAction && <ActionCard action={pendingAction} onApprove={handleApproveAction} onReject={handleRejectAction} />}
        {loading && <TypingIndicator />}
      </div>

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
          <button onClick={sendMessage} disabled={!input.trim() || loading} className="px-3 py-2 rounded-xl bg-forest text-white text-sm font-medium disabled:opacity-30 transition-opacity anim-tap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" onPointerDown={(e) => handlePointerDown(e, "resize-se")} />
      <div className="absolute bottom-0 left-0 right-4 h-1.5 cursor-s-resize" onPointerDown={(e) => handlePointerDown(e, "resize-s")} />
      <div className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize" onPointerDown={(e) => handlePointerDown(e, "resize-e")} />
    </div>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
}: {
  action: PendingAction;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-cerulean/20 bg-cerulean/[0.04] px-3.5 py-3 anim-fade">
        <div className="text-[10px] uppercase tracking-[0.12em] text-cerulean font-semibold mb-2">
          Proposed Change
        </div>
        <p className="text-[13px] text-black/80 leading-relaxed mb-3">
          {action.description}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-cerulean text-white hover:bg-cerulean/90 transition-colors anim-tap"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 text-[11px] font-medium py-1.5 rounded-lg border border-black/10 text-black/40 hover:text-black/60 hover:bg-black/5 transition-colors anim-tap"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
        isUser ? "bg-forest text-white rounded-br-md" : "bg-forest/[0.06] text-black/80 rounded-bl-md"
      }`}>
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
