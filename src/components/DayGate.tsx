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

// Unified task type for the review screen
type ReviewTask = {
  id: string;
  text: string;
  done: boolean;
  notionPageId?: string; // present for Notion tasks
  source: "notion" | "manual"; // where it came from
  action?: "done" | "move" | "drop"; // user's choice for uncompleted tasks
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
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [mood, setMood] = useState<string>("");
  const [note, setNote] = useState("");
  const [scribblebox, setScribblebox] = useState("");
  const [originalTimebox, setOriginalTimebox] = useState<TimeboxEntry[]>([]);
  const [originalTodos, setOriginalTodos] = useState<TodoItem[]>([]);
  const yesterdayDate = getYesterdayISO();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const stateRes = await fetch("/api/state");
        const state = await stateRes.json();

        if (state.last_review === getTodayISO()) {
          if (!cancelled) setStatus("ready");
          return;
        }

        const entries: TimeboxEntry[] = state.timebox ? JSON.parse(state.timebox) : [];
        const scribbleText = state.scribblebox ?? "";

        let todos: TodoItem[] = [];
        try {
          const res = await fetch(`/api/notion-tasks?date=${yesterdayDate}`);
          const data = await res.json();
          todos = data.tasks ?? [];
        } catch { /* continue */ }

        if (!cancelled) {
          setOriginalTimebox(entries);
          setOriginalTodos(todos);
          setScribblebox(scribbleText);

          // Build unified task list — deduplicate Notion tasks that appear in both
          const notionIdsInTimebox = new Set(
            entries.filter((e) => e.notionPageId).map((e) => e.notionPageId)
          );

          const reviewTasks: ReviewTask[] = [];

          // Notion to-do items (not already in timebox)
          for (const todo of todos) {
            if (!notionIdsInTimebox.has(todo.id)) {
              reviewTasks.push({
                id: todo.id,
                text: todo.label,
                done: todo.done,
                notionPageId: todo.id,
                source: "notion",
              });
            }
          }

          // Timebox entries
          for (const entry of entries) {
            reviewTasks.push({
              id: entry.id,
              text: entry.text,
              done: entry.checked,
              notionPageId: entry.notionPageId,
              source: entry.notionPageId ? "notion" : "manual",
            });
          }

          setTasks(reviewTasks);
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

  const setTaskAction = (id: string, action: "done" | "move" | "drop") => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        // Toggle off if same action tapped again
        return { ...t, action: t.action === action ? undefined : action };
      })
    );
  };

  const markReviewedAndClear = async () => {
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "last_review", value: getTodayISO() }),
    });

    // Clear yesterday's timebox
    await fetch("/api/state?key=timebox", { method: "DELETE" });
    window.dispatchEvent(new Event("timebox-clear"));
  };

  const saveAndClear = async () => {
    setStatus("saving");

    try {
      const promises: Promise<unknown>[] = [];
      const manualMovesToTimebox: TimeboxEntry[] = [];

      for (const task of tasks) {
        if (task.done || task.action === "done") {
          // Mark as done in Notion if it's a Notion task
          if (task.notionPageId) {
            promises.push(
              fetch("/api/notion-tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageId: task.notionPageId, done: true }),
              })
            );
          }
        } else if (task.action === "move") {
          if (task.notionPageId) {
            // Update due date to today in Notion
            promises.push(
              fetch("/api/notion-tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageId: task.notionPageId, dueDate: getTodayISO() }),
              })
            );
          } else {
            // Manual task — add to today's timebox
            manualMovesToTimebox.push({
              id: crypto.randomUUID(),
              text: task.text,
              checked: false,
            });
          }
        } else if (task.action === "drop") {
          // Nothing to do — just don't carry it forward
        } else {
          // No action chosen on uncompleted task — sync current state
          if (task.notionPageId) {
            promises.push(
              fetch("/api/notion-tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageId: task.notionPageId, done: task.done }),
              })
            );
          }
        }
      }

      await Promise.allSettled(promises);

      // Archive to daily log
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timebox_entries: originalTimebox,
          todo_items: originalTodos.map((t) => ({ label: t.label, done: t.done })),
          scribblebox,
          note,
          mood,
        }),
      });

      // Clear yesterday's timebox and mark reviewed FIRST
      await markReviewedAndClear();

      // THEN save moved manual tasks to today's timebox (after the clear)
      if (manualMovesToTimebox.length > 0) {
        await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "timebox", value: JSON.stringify(manualMovesToTimebox) }),
        });
      }
    } catch (err) {
      console.error("Save error:", err);
    }

    setStatus("ready");
  };

  const skipReview = async () => {
    setStatus("saving");

    try {
      await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timebox_entries: originalTimebox,
          scribblebox,
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

  // Split tasks into completed and uncompleted
  const completedTasks = tasks.filter((t) => t.done);
  const uncompletedTasks = tasks.filter((t) => !t.done);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-6 md:p-8 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest mb-1">
          Yesterday&apos;s Review
        </h2>
        <p className="text-xs text-black/40 mb-6">{formatDate(yesterdayDate)}</p>

        {/* Uncompleted tasks — need action */}
        {uncompletedTasks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-3">
              Unfinished
            </h3>
            <div className="flex flex-col gap-2">
              {uncompletedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-forest/[0.06] bg-forest/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-black flex-1">{task.text}</span>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      task.source === "notion"
                        ? "bg-cerulean/10 text-cerulean"
                        : "bg-forest/10 text-forest"
                    }`}>
                      {task.source === "notion" ? "Notion" : "Manual"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setTaskAction(task.id, "done")}
                      className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
                        task.action === "done"
                          ? "bg-cerulean text-white border-cerulean"
                          : "text-cerulean border-cerulean/30 hover:bg-cerulean/5"
                      }`}
                    >
                      Done
                    </button>
                    <button
                      onClick={() => setTaskAction(task.id, "move")}
                      className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
                        task.action === "move"
                          ? "bg-forest text-white border-forest"
                          : "text-forest border-forest/30 hover:bg-forest/5"
                      }`}
                    >
                      Move to Today
                    </button>
                    <button
                      onClick={() => setTaskAction(task.id, "drop")}
                      className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
                        task.action === "drop"
                          ? "bg-red-500 text-white border-red-500"
                          : "text-red-400 border-red-300/30 hover:bg-red-50"
                      }`}
                    >
                      Drop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed tasks — just listed */}
        {completedTasks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-2">
              Completed
            </h3>
            <div className="flex flex-col gap-1">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-1.5 px-1"
                >
                  <div className="w-3.5 h-3.5 rounded bg-cerulean border-cerulean flex-shrink-0 flex items-center justify-center">
                    <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm leading-snug line-through text-black/30 flex-1">
                    {task.text}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    task.source === "notion"
                      ? "bg-cerulean/10 text-cerulean"
                      : "bg-forest/10 text-forest"
                  }`}>
                    {task.source === "notion" ? "Notion" : "Manual"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <p className="text-xs text-black/40 mb-6">No tasks from yesterday to review.</p>
        )}

        {/* Mood selector */}
        <div className="mb-6">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-3">
            How was yesterday?
          </h3>
          <div className="flex justify-center gap-4">
            {[
              { color: "#EF4444", value: "terrible" },
              { color: "#F97316", value: "rough" },
              { color: "#EAB308", value: "neutral" },
              { color: "#86EFAC", value: "good" },
              { color: "#22C55E", value: "great" },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(mood === m.value ? "" : m.value)}
                className="transition-transform duration-150"
                style={{
                  transform: mood === m.value ? "scale(1.3)" : "scale(1)",
                }}
                aria-label={m.value}
              >
                <div
                  className="w-8 h-8 rounded-full transition-shadow duration-150"
                  style={{
                    backgroundColor: m.color,
                    boxShadow: mood === m.value ? `0 0 0 3px white, 0 0 0 5px ${m.color}` : "none",
                    opacity: mood && mood !== m.value ? 0.3 : 1,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

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
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
