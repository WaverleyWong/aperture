import TodoList from "@/components/TodoList";
import Timebox from "@/components/Timebox";
import Finances from "@/components/Finances";
import Vitals from "@/components/Vitals";
import TodaysActivities from "@/components/TodaysActivities";
import Fitness from "@/components/Fitness";
import Digest from "@/components/Digest";
import BlokMetrics from "@/components/BlokMetrics";
import Scribblebox from "@/components/Scribblebox";
import ChatAssistant from "@/components/ChatAssistant";
import SkyBanner from "@/components/SkyBanner";
import DayGate from "@/components/DayGate";
import MobileSwipePanel from "@/components/MobileSwipePanel";
import AppShell from "@/components/AppShell";

export default function Home() {
  return (
    <AppShell>
    <SkyBanner>
      <DayGate>
        {/* ── Desktop layout (>=768px) ── */}
        <div className="hidden md:grid grid-cols-[1fr_1.5fr_1.25fr_1.25fr] gap-5 items-start anim-stagger">
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
            {/* Row A: Activities + Vitals/Finance */}
            <div className="grid grid-cols-2 gap-5">
              <TodaysActivities />
              <div className="flex flex-col gap-5">
                <Vitals />
                <Finances />
              </div>
            </div>

            {/* Row B: BLOK Metrics */}
            <BlokMetrics />

            {/* Row C: Digest */}
            <Digest />
          </div>
        </div>

        {/* ── Mobile layout (<768px) ── */}
        <div className="md:hidden flex flex-col gap-4 anim-stagger">
          {/* Swipeable top panels: Timebox (default) / To-Do */}
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
          <Vitals />
          <Finances />
        </div>

        <Scribblebox />
        <ChatAssistant />
      </DayGate>
    </SkyBanner>
    </AppShell>
  );
}
