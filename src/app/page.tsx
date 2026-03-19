import TodoList from "@/components/TodoList";
import Timebox from "@/components/Timebox";
import MonthlyFinance from "@/components/MonthlyFinance";
import CalorieTracker from "@/components/CalorieTracker";
import TodaysActivities from "@/components/TodaysActivities";
import WavesDigest from "@/components/WavesDigest";
import Fitness from "@/components/Fitness";
import WorkDigest from "@/components/WorkDigest";
import BlokMetrics from "@/components/BlokMetrics";

export default function Home() {
  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-forest">
          Aperture
        </h1>
        <span className="text-xs text-black/30">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </header>

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

          {/* Row B: Work Digest */}
          <WorkDigest />

          {/* Row C: BLOK Metrics */}
          <BlokMetrics />
        </div>
      </div>
    </div>
  );
}
