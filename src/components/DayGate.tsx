"use client";

import { useState, useEffect } from "react";

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TimeboxEntry = {
  id: string;
  text: string;
  checked: boolean;
  notionPageId?: string;
};

type TodoItem = {
  id: string;
  label: string;
  done: boolean;
};

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DayGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "review" | "saving" | "ready">("checking");
  const [timeboxEntries, setTimeboxEntries] = useState<TimeboxEntry[]>([]);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [note, setNote] = useState("");
  const [scribblebox, setScribblebox] = useState("");
  const yesterdayDate = getYesterdayISO();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Fetch all live state from Turso
        const stateRes = await fetch("/api/state");
        const state = await stateRes.json();

        const lastReview = state.last_review ?? null;

        // Check if today's review was already completed
        if (lastReview === getTodayISO()) {
          if (!cancelled) setStatus("ready");
          return;
        }

        // Load yesterday's data from live state
        const entries: TimeboxEntry[] = state.timebox ? JSON.parse(state.timebox) : [];
        const scribbleText = state.scribblebox ?? "";

        // Fetch yesterday's Notion tasks
        let tasks: TodoItem[] = [];
        try {
          const res = await fetch(`/api/notion-tasks?date=${yesterdayDate}`);
          const data = await res.json();
          tasks = data.tasks ?? [];
        } catch {
          // Continue without tasks
        }

        if (!cancelled) {
          setTimeboxEntries(entries);
          setTodoItems(tasks);
          setScribblebox(scribbleText);
          setStatus("review");
        }
      } catch (err) {
        console.error("DayGate error:", err);
        if (!cancelled) setStatus("ready");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [yesterdayDate]);

  const toggleTodo = (index: number) => {
    setTodoItems((prev) =>
      prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t))
    );
  };

  const toggleTimebox = (index: number) => {
    setTimeboxEntries((prev) =>
      prev.map((t, i) => (i === index ? { ...t, checked: !t.checked } : t))
    );
  };

  const markReviewedAndClear = async () => {
    // Mark review complete in Turso
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "last_review", value: getTodayISO() }),
    });

    // Clear timebox in Turso for the new day
    await fetch("/api/state?key=timebox", { method: "DELETE" });

    // Notify Timebox component to clear its in-memory state
    window.dispatchEvent(new Event("timebox-clear"));
  };

  const saveAndClear = async () => {
    setStatus("saving");

    try {
      // Sync any toggled tasks to Notion
      const patchPromises: Promise<unknown>[] = [];
      for (const todo of todoItems) {
        patchPromises.push(
          fetch("/api/notion-tasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: todo.id, done: todo.done }),
          })
        );
      }
      for (const entry of timeboxEntries) {
        if (entry.notionPageId) {
          patchPromises.push(
            fetch("/api/notion-tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pageId: entry.notionPageId, done: entry.checked }),
            })
          );
        }
      }
      await Promise.allSettled(patchPromises);

      // Archive to database
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timebox_entries: timeboxEntries,
          todo_items: todoItems.map((t) => ({ label: t.label, done: t.done })),
          scribblebox,
          note,
        }),
      });
    } catch (err) {
      console.error("Save error:", err);
    }

    await markReviewedAndClear();
    setStatus("ready");
  };

  const skipReview = async () => {
    setStatus("saving");

    try {
      // Fetch current live state for archiving
      const stateRes = await fetch("/api/state");
      const state = await stateRes.json();

      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timebox_entries: state.timebox ? JSON.parse(state.timebox) : [],
          scribblebox: state.scribblebox || "",
        }),
      });
    } catch (err) {
      console.error("Skip save error:", err);
    }

    await markReviewedAndClear();
    setStatus("ready");
  };

  if (status === "ready") return <>{children}</>;

  if (status === "checking" || status === "saving") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-5 h-5 animate-spin text-forest/40" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-forest/50">
            {status === "checking" ? "Checking daily log…" : "Saving and refreshing…"}
          </p>
        </div>
      </div>
    );
  }

  // Review screen
  const hasTimebox = timeboxEntries.length > 0;
  const hasTodos = todoItems.length > 0;

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest mb-1">
          Yesterday's Review
        </h2>
        <p className="text-xs text-black/40 mb-6">{formatDate(yesterdayDate)}</p>

        {/* To-Do Items */}
        {hasTodos && (
          <div className="mb-6">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-2">
              To-Do List
            </h3>
            <div className="flex flex-col gap-1">
              {todoItems.map((todo, i) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-forest/5 transition-colors"
                >
                  <button
                    onClick={() => toggleTodo(i)}
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      todo.done
                        ? "bg-cerulean border-cerulean"
                        : "border-forest/30 hover:border-forest/50"
                    }`}
                  >
                    {todo.done && (
                      <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm leading-snug ${todo.done ? "line-through text-black/30" : "text-black"}`}>
                    {todo.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timebox Entries */}
        {hasTimebox && (
          <div className="mb-6">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-2">
              Timebox
            </h3>
            <div className="flex flex-col gap-1">
              {timeboxEntries.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-forest/5 transition-colors"
                >
                  <button
                    onClick={() => toggleTimebox(i)}
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      entry.checked
                        ? "bg-cerulean border-cerulean"
                        : "border-forest/30 hover:border-forest/50"
                    }`}
                  >
                    {entry.checked && (
                      <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm leading-snug ${entry.checked ? "line-through text-black/30" : "text-black"}`}>
                    {entry.text}
                  </span>
                  {entry.notionPageId && (
                    <span className="text-[10px] text-black/20 select-none" title="Synced with Notion">
                      ●
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasTimebox && !hasTodos && (
          <p className="text-xs text-black/40 mb-6">No tasks from yesterday to review.</p>
        )}

        {/* Daily note */}
        <div className="mb-6">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-2">
            Daily Note
          </h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was yesterday? Anything to remember?"
            rows={3}
            className="w-full text-sm bg-transparent border border-forest/10 rounded-xl py-2.5 px-3 placeholder:text-black/25 focus:outline-none focus:border-cerulean transition-colors resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={saveAndClear}
            className="flex-1 text-sm font-medium bg-cerulean text-white py-2.5 px-4 rounded-xl hover:bg-cerulean/90 transition-colors"
          >
            Save and start new day
          </button>
          <button
            onClick={skipReview}
            className="text-sm text-black/40 hover:text-black/60 transition-colors py-2.5 px-4"
          >
            Skip review
          </button>
        </div>
      </div>
    </div>
  );
}
