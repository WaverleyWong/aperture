"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent, DragEvent } from "react";
import Image from "next/image";

export interface TimeboxItem {
  id: string;
  text: string;
  checked: boolean;
  notionPageId?: string;
}

const STATE_KEY = "timebox";

export default function Timebox() {
  const [items, setItems] = useState<TimeboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newText, setNewText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const isExternalDrag = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Turso on mount
  useEffect(() => {
    fetch(`/api/state?key=${STATE_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value) {
          try { setItems(JSON.parse(data.value)); } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Debounced save to Turso on every change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STATE_KEY, value: JSON.stringify(items) }),
      }).catch(() => {});
    }, 300);
  }, [items, loaded]);

  // Listen for day-gate clear event
  useEffect(() => {
    const handler = () => setItems([]);
    window.addEventListener("timebox-clear", handler);
    return () => window.removeEventListener("timebox-clear", handler);
  }, []);

  // Listen for send-to-timebox events from TodoList (mobile tap)
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail as {
        notionPageId: string;
        label: string;
        done: boolean;
      };
      const newItem: TimeboxItem = {
        id: crypto.randomUUID(),
        text: data.label,
        checked: data.done,
        notionPageId: data.notionPageId,
      };
      setItems((prev) => [...prev, newItem]);
    };
    window.addEventListener("todo-send-to-timebox", handler);
    return () => window.removeEventListener("todo-send-to-timebox", handler);
  }, []);

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

  const toggleCheck = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newChecked = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: newChecked } : i))
    );

    // Sync to Notion if this item came from the To-Do List
    if (item.notionPageId) {
      try {
        await fetch("/api/notion-tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: item.notionPageId, done: newChecked }),
        });
      } catch (err) {
        console.error("Failed to update Notion task:", err);
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, checked: !newChecked } : i))
        );
      }
    }
  };

  const deleteItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));

    // Return Notion-linked tasks back to the TodoList
    if (item?.notionPageId) {
      window.dispatchEvent(
        new CustomEvent("todo-restored", { detail: item.notionPageId })
      );
    }
  };

  const startEditing = (item: TimeboxItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setItems((prev) =>
        prev.map((i) => (i.id === editingId ? { ...i, text: trimmed } : i))
      );
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // Internal drag-and-drop for reordering
  const handleDragStart = (e: DragEvent, index: number) => {
    // Mark as internal drag so we don't treat it as a todo drop
    e.dataTransfer.setData("application/timebox-reorder", String(index));
    isExternalDrag.current = false;
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (isExternalDrag.current) return;
    if (dragItem.current === null || dragOverItem.current === null) return;
    const updated = [...items];
    const [dragged] = updated.splice(dragItem.current, 1);
    updated.splice(dragOverItem.current, 0, dragged);
    setItems(updated);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // External drop zone — accepts tasks from TodoList
  const cardRef = useRef<HTMLDivElement>(null);

  const getDropIndex = (e: DragEvent<HTMLDivElement>) => {
    const container = cardRef.current || e.currentTarget;
    const children = Array.from(container.querySelectorAll("[data-timebox-item]"));
    const mouseY = e.clientY;

    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (mouseY < midY) return i;
    }
    return children.length;
  };

  const handleContainerDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("application/todo-task")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    isExternalDrag.current = true;
    setDropIndex(getDropIndex(e));
  };

  const handleContainerDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the container entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropIndex(null);
  };

  const handleContainerDrop = (e: DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData("application/todo-task");
    if (!raw) return;
    e.preventDefault();

    const data = JSON.parse(raw) as {
      notionPageId: string;
      label: string;
      done: boolean;
    };

    const insertAt = getDropIndex(e);
    const newItem: TimeboxItem = {
      id: crypto.randomUUID(),
      text: data.label,
      checked: data.done,
      notionPageId: data.notionPageId,
    };

    setItems((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, newItem);
      return next;
    });

    setDropIndex(null);

    // Notify TodoList to remove the task
    window.dispatchEvent(
      new CustomEvent("todo-dropped", { detail: data.notionPageId })
    );
  };

  const hasItems = items.length > 0;

  return (
    <div
      ref={cardRef}
      className="rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-5 flex flex-col shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]"
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
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
      {/* Items list — also the drop zone */}
      <div
        className={`flex flex-col gap-1 ${items.length > 0 ? "mb-3" : ""}`}
      >
        {items.map((item, index) => (
          <div key={item.id}>
            {/* Drop indicator line */}
            {dropIndex === index && (
              <div className="h-0.5 bg-cerulean rounded-full mx-2 my-0.5" />
            )}
            <div
              data-timebox-item
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="group flex items-center gap-3 py-3 md:py-2 px-2 rounded-lg hover:bg-forest/5 cursor-grab active:cursor-grabbing transition-colors"
            >
              {/* Drag handle */}
              <span className="text-forest/30 group-hover:text-forest/50 text-xs select-none">
                ⠿
              </span>

              {/* Checkbox */}
              <button
                onClick={() => toggleCheck(item.id)}
                className={`w-5 h-5 md:w-4 md:h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
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

              {/* Text — double-click to edit */}
              {editingId === item.id ? (
                <input
                  ref={(el) => {
                    if (el) {
                      el.focus();
                      el.setSelectionRange(0, 0);
                    }
                  }}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                  className="flex-1 text-sm leading-snug bg-transparent border-b border-cerulean py-0 px-0 focus:outline-none"
                />
              ) : (
                <span
                  onDoubleClick={() => startEditing(item)}
                  className={`flex-1 text-sm leading-snug cursor-text ${
                    item.checked
                      ? "line-through text-black/30"
                      : "text-black"
                  }`}
                >
                  {item.text}
                </span>
              )}

              {/* Notion indicator */}
              {item.notionPageId && (
                <span className="text-[10px] text-black/20 select-none" title="Synced with Notion">
                  ●
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-500 transition-all text-xs"
                aria-label="Delete item"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {/* Drop indicator at the end */}
        {dropIndex === items.length && (
          <div className="h-0.5 bg-cerulean rounded-full mx-2 my-0.5" />
        )}
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
