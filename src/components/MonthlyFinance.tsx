import ComponentCard from "./ComponentCard";

const categories = [
  { label: "Groceries", spent: 280, target: 400 },
  { label: "Treat Spend", spent: 95, target: 150 },
  { label: "Travel", spent: 120, target: 200 },
  { label: "Going Out", spent: 180, target: 200 },
  { label: "Self Care", spent: 45, target: 100 },
];

export default function MonthlyFinance() {
  return (
    <ComponentCard title="Monthly Finance" className="h-full">
      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const pct = Math.min((cat.spent / cat.target) * 100, 100);
          const isOver = cat.spent > cat.target;
          return (
            <div key={cat.label}>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs text-black/70">{cat.label}</span>
                <span className="text-xs tabular-nums text-black/50">
                  £{cat.spent}{" "}
                  <span className="text-black/25">/ £{cat.target}</span>
                </span>
              </div>
              <div className="h-2 bg-forest/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isOver ? "#e05252" : "var(--cerulean)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-black/25 mt-5 italic">
        Placeholder — live data coming in Phase 2
      </p>
    </ComponentCard>
  );
}
