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
    widthPct: Math.max(2, (durationDays / totalDays) * 100),
    durationDays,
  };
}

/**
 * Returns month-boundary tick marks with their % position in the timeline.
 * Replaces the old per-week grid that produced 52 collapsed, unreadable columns.
 */
function formatRulerTicks(start: Date, totalDays: number) {
  const ticks: { label: string; pct: number }[] = [];
  ticks.push({
    label: start.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    pct: 0,
  });
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const endMs = start.getTime() + totalDays * DAY_MS;
  while (cursor.getTime() < endMs) {
    const pct = ((cursor.getTime() - start.getTime()) / (totalDays * DAY_MS)) * 100;
    ticks.push({
      label: cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      pct,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

export default function GanttView({ plan, displayMode = "sidebar" }: GanttViewProps) {
  const isFullscreen = displayMode === "fullscreen";
  const start = plan.phases[0]?.startDate;
  const end = plan.phases[plan.phases.length - 1]?.endDate;

  if (!start || !end) {
    return <p className="text-sm text-neutral-500">No timeline data available.</p>;
  }

  const totalDays = daysBetween(start, end);
  const rulerTicks = formatRulerTicks(start, totalDays);
  const allTasks = plan.phases.flatMap((phase) => phase.tasks);
  const generatedLabel = plan.generatedAt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const labelColClass = isFullscreen ? "w-56 shrink-0" : "w-40 shrink-0";

  return (
    <>
      {/* Overview card */}
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
            isFullscreen ? "text-base font-bold text-neutral-900" : "text-sm font-bold text-neutral-900"
          }
        >
          {plan.objective}
        </p>
        <p className="text-xs text-neutral-500">{plan.locationLabel}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          <div>
            <p className="text-[11px] text-neutral-400">Duration</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>
              {totalDays} days
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Phases</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>
              {plan.phases.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Generated</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>
              {generatedLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto">
        <div className={isFullscreen ? "min-w-[900px] pb-2" : "min-w-[520px] pb-2"}>

          {/* Ruler header */}
          <div className={isFullscreen ? "flex items-end gap-4 mb-3" : "flex items-end gap-3 mb-2"}>
            <div className={labelColClass} />
            {/* Ruler with absolutely-positioned month ticks matching the % bar positions */}
            <div className="relative flex-1 h-7">
              {rulerTicks.map((tick) => (
                <span
                  key={`tick-${tick.pct}`}
                  className="absolute top-0 -translate-x-1/2 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
                  style={{ left: `${tick.pct}%` }}
                >
                  {tick.label}
                </span>
              ))}
              <span className="absolute bottom-0 left-0 right-0 h-px bg-neutral-200" />
            </div>
          </div>

          {/* Task rows */}
          <div className={isFullscreen ? "space-y-3" : "space-y-2"}>
            {allTasks.map((task) => {
              const tl = toOffset(task, start, totalDays);
              return (
                <div
                  key={task.id}
                  className={isFullscreen ? "flex items-center gap-4" : "flex items-center gap-3"}
                >
                  {/* Label */}
                  <div className={labelColClass}>
                    <p
                      className={
                        isFullscreen
                          ? "text-sm font-semibold text-neutral-800 leading-tight truncate"
                          : "text-xs font-semibold text-neutral-800 leading-tight truncate"
                      }
                      title={task.title}
                    >
                      {task.title}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{tl.durationDays} days</p>
                  </div>

                  {/* Bar track */}
                  <div
                    className={
                      isFullscreen
                        ? "relative flex-1 h-7 rounded-lg bg-neutral-100 border border-neutral-200"
                        : "relative flex-1 h-5 rounded-md bg-neutral-100 border border-neutral-200"
                    }
                  >
                    {/* Month-boundary guide lines */}
                    {rulerTicks.map((tick) => (
                      <span
                        key={`guide-${tick.pct}`}
                        className="absolute top-0 bottom-0 w-px bg-neutral-200/70 pointer-events-none"
                        style={{ left: `${tick.pct}%` }}
                      />
                    ))}

                    {/* Gantt bar */}
                    <div
                      className={
                        isFullscreen
                          ? "absolute inset-y-1 rounded-md bg-emerald-500 shadow-sm"
                          : "absolute inset-y-0.5 rounded bg-emerald-500 shadow-sm"
                      }
                      style={{
                        left: `${tl.leftPct}%`,
                        width: `${tl.widthPct}%`,
                        minWidth: isFullscreen ? "8px" : "6px",
                      }}
                      title={`${task.title} — ${tl.durationDays} days`}
                    />
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
