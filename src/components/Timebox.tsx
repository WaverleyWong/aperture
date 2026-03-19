"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import Image from "next/image";

interface TimeboxItem {
  id: string;
  text: string;
  checked: boolean;
}

export default function Timebox() {
  const [items, setItems] = useState<TimeboxItem[]>([]);
  const [newText, setNewText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleTitleClick = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, [refreshing]);

  const addItem = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: trimmed, checked: false },
    ]);
    setNewText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const toggleCheck = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const updated = [...items];
    const [dragged] = updated.splice(dragItem.current, 1);
    updated.splice(dragOverItem.current, 0, dragged);
    setItems(updated);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const hasItems = items.length > 0;

  return (
    <div className="rounded-3xl border border-forest/20 bg-white/60 backdrop-blur-sm p-5 flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        onClick={handleTitleClick}
        className="flex items-center gap-2 mb-4 text-left cursor-pointer group"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest group-hover:text-forest/70 transition-colors">
          Timebox
        </h2>
        <span
          className={`transition-opacity duration-200 ${refreshing ? "opacity-100" : "opacity-0"}`}
        >
          <svg
            className="w-3 h-3 animate-spin text-forest/40"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="28"
              strokeDashoffset="8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      <div className={`flex-1 flex flex-col transition-opacity duration-300 ${refreshing ? "opacity-30" : "opacity-100"}`}>
      {/* Items list */}
      <div className="flex flex-col gap-1 mb-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className="group flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-forest/5 cursor-grab active:cursor-grabbing transition-colors"
          >
            {/* Drag handle */}
            <span className="text-forest/30 group-hover:text-forest/50 text-xs select-none">
              ⠿
            </span>

            {/* Checkbox */}
            <button
              onClick={() => toggleCheck(item.id)}
              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                item.checked
                  ? "bg-cerulean border-cerulean"
                  : "border-forest/30 hover:border-forest/50"
              }`}
            >
              {item.checked && (
                <svg
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {/* Text */}
            <span
              className={`flex-1 text-sm leading-snug ${
                item.checked
                  ? "line-through text-black/30"
                  : "text-black"
              }`}
            >
              {item.text}
            </span>

            {/* Delete */}
            <button
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-500 transition-all text-xs"
              aria-label="Delete item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex items-center gap-2 mt-auto">
        <input
          ref={inputRef}
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add to timebox..."
          className="flex-1 text-sm bg-transparent border-b border-forest/15 py-2 px-1 placeholder:text-black/25 focus:outline-none focus:border-cerulean transition-colors"
        />
        <button
          onClick={addItem}
          disabled={!newText.trim()}
          className="text-cerulean disabled:text-black/15 hover:text-cerulean/80 transition-colors text-lg leading-none font-light"
          aria-label="Add item"
        >
          +
        </button>
      </div>

      {/* Doodle — shown when no items */}
      {!hasItems && (
        <div className="flex justify-center mt-8 mb-2 opacity-40">
          <Image
            src="/doodle.png"
            alt=""
            width={120}
            height={120}
            className="select-none pointer-events-none"
          />
        </div>
      )}
      </div>
    </div>
  );
}
