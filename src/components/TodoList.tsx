"use client";

import { useState } from "react";
import ComponentCard from "./ComponentCard";

const initialTasks = [
  { label: "Review Q1 campaign brief", done: true },
  { label: "Prep for 1:1 with Sarah", done: false },
  { label: "Update sprint board", done: false },
  { label: "Send invoice to vendor", done: false },
  { label: "Draft social copy for launch", done: false },
];

export default function TodoList() {
  const [tasks, setTasks] = useState(initialTasks);

  const toggleTask = (index: number) => {
    setTasks((prev) =>
      prev.map((task, i) =>
        i === index ? { ...task, done: !task.done } : task
      )
    );
  };

  const deleteTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ComponentCard title="To-Do List" className="h-full overflow-hidden">
      <div className="flex flex-col gap-1 component-scroll overflow-y-auto">
        {tasks.map((task, i) => (
          <div
            key={i}
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
            <button
              onClick={() => deleteTask(i)}
              className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-500 transition-all text-xs"
              aria-label="Delete task"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-black/25 mt-4 italic">
        Placeholder — Notion integration coming in Phase 2
      </p>
    </ComponentCard>
  );
}
