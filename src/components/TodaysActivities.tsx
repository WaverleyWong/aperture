import ComponentCard from "./ComponentCard";

const placeholderEvents = [
  { time: "12:30", label: "Lunch with Jess", type: "personal" },
  { time: "14:00", label: "Team standup", type: "work" },
  { time: "17:00", label: "Yoga class", type: "personal" },
];

export default function TodaysActivities() {
  return (
    <ComponentCard title="Today's Activities">
      <div className="flex flex-col gap-2">
        {placeholderEvents.map((evt, i) => (
          <div key={i} className="flex items-baseline gap-2.5">
            <span className="text-xs tabular-nums text-black/40 w-10 flex-shrink-0">
              {evt.time}
            </span>
            <span className="text-sm text-black">{evt.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-black/25 mt-4 italic">
        Placeholder — Google Calendar integration coming in Phase 2
      </p>
    </ComponentCard>
  );
}
