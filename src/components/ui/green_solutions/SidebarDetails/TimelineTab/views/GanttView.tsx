import type { TimelinePlan, TimelineTask } from "../types";

interface GanttViewProps {
  plan: TimelinePlan;
  displayMode?: "sidebar" | "fullscreen";
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Pixels per calendar day — controls how wide the chart is */
const PX_PER_DAY_SIDEBAR = 5;
const PX_PER_DAY_FULLSCREEN = 6;

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function dayOffset(date: Date, origin: Date) {
  return Math.max(0, Math.round((date.getTime() - origin.getTime()) / DAY_MS));
}

interface RulerTick {
  label: string;
  px: number;
}

/**
 * Returns month-boundary tick marks with pixel positions.
 * The first tick shows the project start date; subsequent ticks are on the 1st of each month.
 */
function buildRulerTicks(start: Date, totalDays: number, pxPerDay: number): RulerTick[] {
  const ticks: RulerTick[] = [];

  // Start tick
  ticks.push({
    label: start.toLocaleDateString("en-PH", { month: "short", day: "numeric" }).toUpperCase(),
    px: 0,
  });

  // Monthly ticks
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const endMs = start.getTime() + totalDays * DAY_MS;
  while (cursor.getTime() < endMs) {
    const days = dayOffset(cursor, start);
    ticks.push({
      label: cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" }).toUpperCase(),
      px: days * pxPerDay,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

function toBarPx(task: TimelineTask, origin: Date, pxPerDay: number) {
  const offset = dayOffset(task.startDate, origin);
  const duration = daysBetween(task.startDate, task.endDate);
  return {
    leftPx: offset * pxPerDay,
    widthPx: Math.max(8, duration * pxPerDay),
    durationDays: duration,
  };
}

export default function GanttView({ plan, displayMode = "sidebar" }: GanttViewProps) {
  const isFullscreen = displayMode === "fullscreen";
  const start = plan.phases[0]?.startDate;
  const end = plan.phases[plan.phases.length - 1]?.endDate;

  if (!start || !end) {
    return <p className="text-sm text-neutral-500">No timeline data available.</p>;
  }

  const pxPerDay = isFullscreen ? PX_PER_DAY_FULLSCREEN : PX_PER_DAY_SIDEBAR;
  const totalDays = daysBetween(start, end);
  const chartWidth = totalDays * pxPerDay;
  const rulerTicks = buildRulerTicks(start, totalDays, pxPerDay);
  const allTasks = plan.phases.flatMap((phase) => phase.tasks);
  const generatedLabel = plan.generatedAt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const dateRangeLabel = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;

  const rowHeight = isFullscreen ? 56 : 46;
  const rowGap = isFullscreen ? 10 : 8;
  const barInsetY = isFullscreen ? 10 : 9;
  const barHeight = rowHeight - barInsetY * 2;
  const labelWidth = isFullscreen ? 260 : 220;

  return (
    <div className={isFullscreen ? "space-y-6" : "space-y-4"}>
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

      <section
        className={
          isFullscreen
            ? "rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm"
            : "rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              Implementation Schedule
            </p>
            <p className={isFullscreen ? "mt-1 text-base font-bold text-neutral-900" : "mt-1 text-sm font-bold text-neutral-900"}>
              {dateRangeLabel}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Scroll horizontally to inspect the full timeline. Export keeps the same visible framing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              Active task bars
            </span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
              {allTasks.length} tasks
            </span>
          </div>
        </div>

        {/* Gantt chart — fixed labels on the left, scrollable chart on the right */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50/70">
          <div className="flex min-w-0">
            {/* Fixed label column */}
            <div className="shrink-0 border-r border-neutral-100 bg-white/95" style={{ width: labelWidth }}>
              <div className="flex items-end border-b border-neutral-100 px-4 pb-2.5 pt-3" style={{ height: 38 }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                  Task
                </p>
              </div>

              {allTasks.map((task) => {
                const tl = toBarPx(task, start, pxPerDay);
                return (
                  <div
                    key={task.id}
                    className="flex flex-col justify-center border-b border-neutral-100/80 px-4"
                    style={{ height: rowHeight, marginBottom: rowGap }}
                  >
                    <p
                      className={
                        isFullscreen
                          ? "text-sm font-semibold text-neutral-800 leading-tight"
                          : "text-xs font-semibold text-neutral-800 leading-tight"
                      }
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={task.title}
                    >
                      {task.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                      {tl.durationDays} days
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Scrollable chart area */}
            <div data-export-scroll="gantt-chart" className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
              <div className="px-3 pb-3 pt-2" style={{ width: chartWidth + 24, minWidth: "100%" }}>
                {/* Ruler */}
                <div className="relative border-b border-neutral-100" style={{ height: 38 }}>
                  {rulerTicks.map((tick, i) => (
                    <span
                      key={i}
                      className="absolute bottom-2 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
                      style={{ left: tick.px + 4 }}
                    >
                      {tick.label}
                    </span>
                  ))}
                  <span className="absolute bottom-0 left-0 h-px bg-neutral-200" style={{ width: chartWidth }} />
                </div>

                {/* Chart rows */}
                {allTasks.map((task) => {
                  const tl = toBarPx(task, start, pxPerDay);
                  return (
                    <div
                      key={task.id}
                      className="relative overflow-hidden rounded-xl border border-neutral-100 bg-white/90"
                      style={{ height: rowHeight, marginBottom: rowGap }}
                    >
                      {rulerTicks.map((tick, i) => (
                        <span
                          key={i}
                          className="pointer-events-none absolute bottom-0 top-0 w-px bg-neutral-200/70"
                          style={{ left: tick.px }}
                        />
                      ))}

                      <div
                        className="absolute rounded-full border border-emerald-600/10 bg-emerald-500 shadow-[0_10px_24px_-14px_rgba(16,185,129,0.9)]"
                        style={{
                          left: tl.leftPx,
                          width: tl.widthPx,
                          top: barInsetY,
                          height: barHeight,
                        }}
                        title={`${task.title} — ${tl.durationDays} days`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
