import type { TimelinePlan, TimelineTask } from "../types";

interface GanttViewProps {
  plan: TimelinePlan;
  displayMode?: "sidebar" | "fullscreen";
}

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function toOffset(task: TimelineTask, start: Date, totalDays: number) {
  const offsetDays = Math.max(
    0,
    Math.round((task.startDate.getTime() - start.getTime()) / DAY_MS),
  );
  const durationDays = daysBetween(task.startDate, task.endDate);
  return {
    leftPct: (offsetDays / totalDays) * 100,
    widthPct: Math.max(6, (durationDays / totalDays) * 100),
    durationDays,
  };
}

function formatWeekLabels(start: Date, totalDays: number) {
  const weekCount = Math.max(4, Math.ceil(totalDays / 7));
  return Array.from({ length: weekCount }, (_, index) => {
    const labelDate = new Date(start);
    labelDate.setDate(start.getDate() + index * 7);
    return labelDate.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
  });
}

export default function GanttView({ plan, displayMode = "sidebar" }: GanttViewProps) {
  const isFullscreen = displayMode === "fullscreen";
  const start = plan.phases[0]?.startDate;
  const end = plan.phases[plan.phases.length - 1]?.endDate;

  if (!start || !end) {
    return <p className="text-sm text-neutral-500">No timeline data available.</p>;
  }

  const totalDays = daysBetween(start, end);
  const weekLabels = formatWeekLabels(start, totalDays);
  const allTasks = plan.phases.flatMap((phase) => phase.tasks);
  const generatedLabel = plan.generatedAt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div
        className={
          isFullscreen
            ? "rounded-[28px] border border-neutral-100 bg-neutral-50 p-5"
            : "rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
        }
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
          Overview
        </p>
        <p
          className={
            isFullscreen
              ? "text-base font-bold text-neutral-900"
              : "text-sm font-bold text-neutral-900"
          }
        >
          {plan.objective}
        </p>
        <p className="text-xs text-neutral-500">{plan.locationLabel}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          <div>
            <p className="text-[11px] text-neutral-400">Duration</p>
            <p
              className={
                isFullscreen
                  ? "text-sm font-semibold text-neutral-700"
                  : "text-xs font-semibold text-neutral-700"
              }
            >
              {totalDays} days
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Phases</p>
            <p
              className={
                isFullscreen
                  ? "text-sm font-semibold text-neutral-700"
                  : "text-xs font-semibold text-neutral-700"
              }
            >
              {plan.phases.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Generated</p>
            <p
              className={
                isFullscreen
                  ? "text-sm font-semibold text-neutral-700"
                  : "text-xs font-semibold text-neutral-700"
              }
            >
              {generatedLabel}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
      <div className={isFullscreen ? "space-y-6 min-w-[1120px] px-3 pb-4" : "space-y-4 min-w-[760px] px-2"}>
        <div className={isFullscreen ? "grid grid-cols-12 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500" : "grid grid-cols-12 text-[11px] font-semibold text-neutral-500"}>
          <span className="col-span-3">Task</span>
          <span className="col-span-9 grid" style={{ gridTemplateColumns: `repeat(${weekLabels.length}, minmax(0, 1fr))` }}>
            {weekLabels.map((label) => (
              <span key={label} className={isFullscreen ? "text-center px-2" : "text-center px-1"}>
                {label}
              </span>
            ))}
          </span>
        </div>

        <div className={isFullscreen ? "space-y-4" : "space-y-3"}>
          {allTasks.map((task) => {
            const timeline = toOffset(task, start, totalDays);
            return (
              <div key={task.id} className={isFullscreen ? "grid grid-cols-12 items-center gap-4" : "grid grid-cols-12 items-center gap-3"}>
                <div className="col-span-3">
                  <p className={isFullscreen ? "text-base font-semibold text-neutral-800 leading-tight" : "text-sm font-semibold text-neutral-800 leading-tight"}>
                    {task.title}
                  </p>
                  <p className={isFullscreen ? "mt-1 text-sm text-neutral-500" : "text-xs text-neutral-500"}>{timeline.durationDays} days</p>
                </div>

                <div className={isFullscreen ? "col-span-9 relative h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden" : "col-span-9 relative h-9 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden"}>
                  <div
                    className={isFullscreen ? "absolute top-1.5 bottom-1.5 rounded-lg bg-emerald-500/90 text-white text-xs px-3 flex items-center shadow-sm" : "absolute top-1 bottom-1 rounded-md bg-emerald-500/90 text-white text-[11px] px-2 flex items-center shadow-sm"}
                    style={{
                      left: `${timeline.leftPct}%`,
                      width: `${timeline.widthPct}%`,
                    }}
                  >
                    {task.phaseId}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
