import ComponentCard from "./ComponentCard";

const placeholderTasks = [
  { label: "Review Q1 campaign brief", done: true },
  { label: "Prep for 1:1 with Sarah", done: false },
  { label: "Update sprint board", done: false },
  { label: "Send invoice to vendor", done: false },
  { label: "Draft social copy for launch", done: false },
];

export default function TodoList() {
  return (
    <ComponentCard title="To-Do List" className="h-full overflow-hidden">
      <div className="flex flex-col gap-1 component-scroll overflow-y-auto">
        {placeholderTasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div
              className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                task.done
                  ? "bg-cerulean border-cerulean"
                  : "border-forest/30"
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
            </div>
            <span
              className={`text-sm leading-snug ${
                task.done ? "line-through text-black/30" : "text-black"
              }`}
            >
              {task.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-black/25 mt-4 italic">
        Placeholder — Notion integration coming in Phase 2
      </p>
    </ComponentCard>
  );
}
