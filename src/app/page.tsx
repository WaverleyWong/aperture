import TodoList from "@/components/TodoList";
import Timebox from "@/components/Timebox";
import MonthlyFinance from "@/components/MonthlyFinance";
import CalorieTracker from "@/components/CalorieTracker";
import TodaysActivities from "@/components/TodaysActivities";
import Fitness from "@/components/Fitness";
import Digest from "@/components/Digest";
import BlokMetrics from "@/components/BlokMetrics";
import Scribblebox from "@/components/Scribblebox";
import SkyBanner from "@/components/SkyBanner";
import DayGate from "@/components/DayGate";
import MobileSwipePanel from "@/components/MobileSwipePanel";

export default function Home() {
  return (
    <SkyBanner>
      <DayGate>
        {/* ── Desktop layout (>=768px) ── */}
        <div className="hidden md:grid grid-cols-[1fr_1.5fr_1.25fr_1.25fr] gap-5 items-start">
          {/* Column 1 */}
          <div className="flex flex-col gap-5">
            <TodoList />
            <Fitness />
          </div>

          {/* Column 2 */}
          <div>
            <Timebox />
          </div>

          {/* Columns 3-4 */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Row A: Activities + Calorie/Finance */}
            <div className="grid grid-cols-2 gap-5">
              <TodaysActivities />
              <div className="flex flex-col gap-5">
                <CalorieTracker />
                <MonthlyFinance />
              </div>
            </div>

            {/* Row B: BLOK Metrics */}
            <BlokMetrics />

            {/* Row C: Digest */}
            <Digest />
          </div>
        </div>

        {/* ── Mobile layout (<768px) ── */}
        <div className="md:hidden flex flex-col gap-4">
          {/* Swipeable top panels: To-Do (default) / Timebox */}
          <MobileSwipePanel
            defaultIndex={0}
            panels={[
              { key: "timebox", label: "Timebox", content: <Timebox /> },
              { key: "todo", label: "To-Do", content: <TodoList /> },
            ]}
          />

          {/* Stacked components */}
          <TodaysActivities />
          <Digest />
          <BlokMetrics />
          <CalorieTracker />
          <MonthlyFinance />
        </div>

        <Scribblebox />
      </DayGate>
    </SkyBanner>
  );
}
