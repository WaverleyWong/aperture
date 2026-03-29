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
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const editInitialised = useRef(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const isExternalDrag = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from Turso
  const loadFromTurso = useCallback(() => {
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

  // Load on mount
  useEffect(() => { loadFromTurso(); }, [loadFromTurso]);

  // Listen for global refresh
  useEffect(() => {
    const handler = () => loadFromTurso();
    window.addEventListener("aperture-refresh-all", handler);
    return () => window.removeEventListener("aperture-refresh-all", handler);
  }, [loadFromTurso]);

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
    const handler = () => {
      setItems([]);
      setReorderingId(null);
    };
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

  // Dismiss reorder controls when tapping outside
  useEffect(() => {
    if (!reorderingId) return;
    const dismiss = () => setReorderingId(null);
    window.addEventListener("click", dismiss);
    return () => window.removeEventListener("click", dismiss);
  }, [reorderingId]);

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

  // Immediately persist items to Turso (bypasses debounce)
  const flushSave = (updatedItems: TimeboxItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: STATE_KEY, value: JSON.stringify(updatedItems) }),
    }).catch(() => {});
  };

  const deleteItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    setReorderingId(null);

    if (item?.notionPageId) {
      flushSave(updated);
      // Send full task data so TodoList can add it back instantly
      window.dispatchEvent(
        new CustomEvent("todo-restored", {
          detail: { id: item.notionPageId, label: item.text, done: item.checked },
        })
      );
    }
  };

  const sendToTodo = (item: TimeboxItem) => {
    const updated = items.filter((i) => i.id !== item.id);
    setItems(updated);
    setReorderingId(null);

    flushSave(updated);
    // Send full task data so TodoList can add it back instantly
    if (item.notionPageId) {
      window.dispatchEvent(
        new CustomEvent("todo-restored", {
          detail: { id: item.notionPageId, label: item.text, done: item.checked },
        })
      );
    }
  };

  const startEditing = (item: TimeboxItem) => {
    editInitialised.current = false;
    setEditingId(item.id);
    setEditText(item.text);
    setReorderingId(null);
  };

  const commitEdit = () => {
    if (editingId === null) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setItems((prev) =>
        prev.map((i) => (i.id === editingId ? { ...i, text: trimmed } : i))
      );
    } else {
      // Remove empty entries
      setItems((prev) => prev.filter((i) => i.id !== editingId));
    }
    setEditingId(null);
  };

  const commitEditAndAddBelow = () => {
    if (editingId === null) return;
    const trimmed = editText.trim();
    const newId = crypto.randomUUID();

    setItems((prev) => {
      const updated = trimmed
        ? prev.map((i) => (i.id === editingId ? { ...i, text: trimmed } : i))
        : prev.filter((i) => i.id !== editingId); // remove if empty

      // Insert new entry below the current one
      const idx = updated.findIndex((i) => i.id === editingId);
      const insertAt = idx >= 0 ? idx + 1 : updated.length;
      const next = [...updated];
      next.splice(insertAt, 0, { id: newId, text: "", checked: false });
      return next;
    });

    // Start editing the new entry
    editInitialised.current = false;
    setEditingId(newId);
    setEditText("");
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEditAndAddBelow();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // Mobile reorder: move item up or down
  const moveItem = (id: string, direction: "up" | "down") => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // Long-press handling for mobile
  const handleTouchStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setReorderingId(id);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Internal drag-and-drop for reordering (desktop only)
  const handleDragStart = (e: DragEvent, index: number) => {
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

  // External drop zone — accepts tasks from TodoList (desktop)
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

    window.dispatchEvent(
      new CustomEvent("todo-dropped", { detail: data.notionPageId })
    );
  };

  const hasItems = items.length > 0;

  return (
    <div
      ref={cardRef}
      className="anim-fade-in rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-5 flex flex-col shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]"
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
      {/* Items list */}
      <div
        className={`flex flex-col gap-1 ${items.length > 0 ? "mb-3" : ""}`}
      >
        {items.map((item, index) => (
          <div key={item.id}>
            {/* Drop indicator line (desktop drag-and-drop) */}
            {dropIndex === index && (
              <div className="h-0.5 bg-cerulean rounded-full mx-2 my-0.5" />
            )}

            <div
              data-timebox-item
              // Desktop: draggable for reorder
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              // Mobile: long-press to show reorder controls
              onTouchStart={() => handleTouchStart(item.id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              onClick={(e) => e.stopPropagation()}
              className={`group flex items-center gap-3 py-3 md:py-2 px-2 rounded-lg transition-colors ${
                reorderingId === item.id
                  ? "bg-cerulean/10"
                  : "hover:bg-forest/5 md:cursor-grab md:active:cursor-grabbing"
              }`}
            >
              {/* Drag handle — desktop only */}
              <span className="hidden md:inline text-forest/30 group-hover:text-forest/50 text-xs select-none">
                ⠿
              </span>

              {/* Checkbox */}
              <button
                onClick={() => toggleCheck(item.id)}
                className={`anim-tap w-5 h-5 md:w-4 md:h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
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
                    editInputRef.current = el;
                    if (el && !editInitialised.current) {
                      editInitialised.current = true;
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
                      ? "anim-strike text-black/30"
                      : "text-black"
                  }`}
                >
                  {item.text}
                </span>
              )}

              {/* Notion indicator */}
              {item.notionPageId && (
                <span className="text-[10px] text-black/20 select-none hidden md:inline" title="Synced with Notion">
                  ●
                </span>
              )}

              {/* Mobile: Send back to To-Do (for Notion tasks) */}
              {item.notionPageId && (
                <button
                  onClick={(e) => { e.stopPropagation(); sendToTodo(item); }}
                  className="md:hidden text-forest/40 hover:text-cerulean transition-all p-1"
                  aria-label="Send back to To-Do"
                  title="Send back to To-Do"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}

              {/* Desktop: Send back to To-Do (hover) */}
              {item.notionPageId && (
                <button
                  onClick={(e) => { e.stopPropagation(); sendToTodo(item); }}
                  className="hidden md:block opacity-0 group-hover:opacity-100 text-forest/40 hover:text-cerulean transition-all p-1"
                  aria-label="Send back to To-Do"
                  title="Send back to To-Do"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 5 5 12 12 19" />
                  </svg>
                </button>
              )}

              {/* Delete — desktop hover only */}
              <button
                onClick={() => deleteItem(item.id)}
                className="hidden md:block opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-500 transition-all text-xs"
                aria-label="Delete item"
              >
                ✕
              </button>
            </div>

            {/* Mobile reorder controls — shown on long-press */}
            {reorderingId === item.id && (
              <div
                className="md:hidden flex items-center justify-between px-3 py-1.5 bg-forest/[0.04] rounded-lg mx-1 mt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => moveItem(item.id, "up")}
                    disabled={index === 0}
                    className="p-2 rounded-lg text-forest/50 hover:text-forest disabled:text-black/15 transition-colors"
                    aria-label="Move up"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveItem(item.id, "down")}
                    disabled={index === items.length - 1}
                    className="p-2 rounded-lg text-forest/50 hover:text-forest disabled:text-black/15 transition-colors"
                    aria-label="Move down"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditing(item)}
                    className="p-2 rounded-lg text-forest/50 hover:text-cerulean transition-colors text-xs"
                    aria-label="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 rounded-lg text-black/30 hover:text-red-500 transition-colors text-xs"
                    aria-label="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
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
