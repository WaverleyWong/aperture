import TodoList from "@/components/TodoList";
import Timebox from "@/components/Timebox";
import MonthlyFinance from "@/components/MonthlyFinance";
import CalorieTracker from "@/components/CalorieTracker";
import TodaysActivities from "@/components/TodaysActivities";
import WavesDigest from "@/components/WavesDigest";
import Fitness from "@/components/Fitness";
import WorkDigest from "@/components/WorkDigest";
import BlokMetrics from "@/components/BlokMetrics";
import Scribblebox from "@/components/Scribblebox";
import SkyBanner from "@/components/SkyBanner";
import DayGate from "@/components/DayGate";

export default function Home() {
  return (
    <SkyBanner>
      <DayGate>
        {/* Dashboard Grid */}
        <div className="grid grid-cols-[1fr_1.5fr_1.25fr_1.25fr] gap-5 items-start">
          {/* Column 1 */}
          <div className="flex flex-col gap-5">
            <TodoList />
            <WavesDigest />
            <Fitness />
          </div>

          {/* Column 2 */}
          <div>
            <Timebox />
          </div>

          {/* Columns 3-4 */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Row A: Finance + Calorie/Activities */}
            <div className="grid grid-cols-2 gap-5">
              <TodaysActivities />
              <div className="flex flex-col gap-5">
                <CalorieTracker />
                <MonthlyFinance />
              </div>
            </div>

            {/* Row B: BLOK Metrics */}
            <BlokMetrics />

            {/* Row C: Work Digest */}
            <WorkDigest />
          </div>
        </div>

        <Scribblebox />
      </DayGate>
    </SkyBanner>
  );
}
