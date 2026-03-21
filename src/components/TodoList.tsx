"use client";

import { useState, useEffect, useCallback } from "react";
import ComponentCard from "./ComponentCard";

type Task = {
  id: string;
  label: string;
  done: boolean;
};

export default function TodoList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/notion-tasks");
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
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

  const toggleTask = async (index: number) => {
    const task = tasks[index];
    const newDone = !task.done;

    // Optimistic update
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
      // Revert on failure
      setTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, done: !newDone } : t))
      );
    }
  };

  return (
    <ComponentCard title="To-Do List" className="h-full overflow-hidden">
      <div className="flex flex-col gap-1 component-scroll overflow-y-auto">
        {loading ? (
          <p className="text-xs text-black/40 py-2">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-black/40 py-2">No tasks due today.</p>
        ) : (
          tasks.map((task, i) => (
            <div
              key={task.id}
              className="group flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-forest/5 transition-colors"
            >
              <button
                onClick={() => toggleTask(i)}
                className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.done
                    ? "bg-cerulean border-cerulean"
                    : "border-forest/30 hover:border-forest/50"
                }`}
              >
                {task.done && (
                  <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
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
            </div>
          ))
        )}
      </div>
    </ComponentCard>
  );
}
