"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import ComponentCard from "./ComponentCard";

type Task = {
  id: string;
  label: string;
  done: boolean;
};

export default function TodoList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const movedIds = useRef<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/notion-tasks");
      const data = await res.json();
      if (data.tasks) {
        // Filter out tasks that have been moved to the Timebox this session
        setTasks(
          (data.tasks as Task[]).filter((t) => !movedIds.current.has(t.id))
        );
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Listen for drop events from Timebox to remove the task
  useEffect(() => {
    const handleDrop = (e: Event) => {
      const taskId = (e as CustomEvent<string>).detail;
      movedIds.current.add(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };
    const handleRestore = (e: Event) => {
      const taskId = (e as CustomEvent<string>).detail;
      movedIds.current.delete(taskId);
      // Re-fetch to bring the task back with its current Notion state
      fetchTasks();
    };
    window.addEventListener("todo-dropped", handleDrop);
    window.addEventListener("todo-restored", handleRestore);
    return () => {
      window.removeEventListener("todo-dropped", handleDrop);
      window.removeEventListener("todo-restored", handleRestore);
    };
  }, [fetchTasks]);

  const toggleTask = async (index: number) => {
    const task = tasks[index];
    const newDone = !task.done;

    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, done: newDone } : t))
    );

    try {
      await fetch("/api/notion-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: task.id, done: newDone }),
      });
    } catch (err) {
      console.error("Failed to update task:", err);
      setTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, done: !newDone } : t))
      );
    }
  };

  const handleDragStart = (e: DragEvent, task: Task) => {
    e.dataTransfer.setData(
      "application/todo-task",
      JSON.stringify({
        notionPageId: task.id,
        label: task.label,
        done: task.done,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const sendToTimebox = (task: Task) => {
    // Dispatch the same events that drag-and-drop uses
    window.dispatchEvent(
      new CustomEvent("todo-send-to-timebox", {
        detail: { notionPageId: task.id, label: task.label, done: task.done },
      })
    );
    movedIds.current.add(task.id);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  return (
    <ComponentCard title="To-Do List" className="h-full overflow-hidden" onRefresh={fetchTasks}>
      <div className="flex flex-col gap-1 component-scroll overflow-y-auto">
        {loading ? (
          <p className="text-xs text-black/40 py-2">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-black/40 py-2">No tasks due today.</p>
        ) : (
          tasks.map((task, i) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
              className="group flex items-center gap-3 py-2.5 md:py-1.5 px-1 rounded-lg hover:bg-forest/5 transition-colors cursor-grab active:cursor-grabbing"
            >
              <button
                onClick={() => toggleTask(i)}
                className={`w-5 h-5 md:w-3.5 md:h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.done
                    ? "bg-cerulean border-cerulean"
                    : "border-forest/30 hover:border-forest/50"
                }`}
              >
                {task.done && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span
                className={`flex-1 text-sm leading-snug ${
                  task.done ? "line-through text-black/30" : "text-black"
                }`}
              >
                {task.label}
              </span>
              {/* Send to Timebox — visible on mobile, hover on desktop */}
              {!task.done && (
                <button
                  onClick={() => sendToTimebox(task)}
                  className="md:opacity-0 md:group-hover:opacity-100 text-forest/40 hover:text-cerulean transition-all p-1"
                  aria-label="Send to Timebox"
                  title="Send to Timebox"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </ComponentCard>
  );
}
