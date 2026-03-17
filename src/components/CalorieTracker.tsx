import ComponentCard from "./ComponentCard";

export default function CalorieTracker() {
  const eaten = 820;
  const target = 1600;
  const pct = Math.round((eaten / target) * 100);

  return (
    <ComponentCard title="Calories">
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-light tabular-nums text-black">
          {eaten}
        </span>
        <span className="text-sm text-black/30">/ {target}</span>
      </div>
      <div className="h-2 bg-forest/8 rounded-full overflow-hidden mt-3">
        <div
          className="h-full rounded-full bg-cerulean transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-black/25 mt-4 italic">
        Placeholder — Google Sheets integration coming in Phase 2
      </p>
    </ComponentCard>
  );
}
