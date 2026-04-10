import type { TimelinePlan, TimelineTask } from "../types";

interface GanttViewProps {
  plan: TimelinePlan;
  onOpenPhase?: (phaseId: string, taskId?: string) => void;
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

export default function GanttView({ plan, onOpenPhase }: GanttViewProps) {
  const start = plan.phases[0]?.startDate;
  const end = plan.phases[plan.phases.length - 1]?.endDate;

  if (!start || !end) {
    return <p className="text-sm text-neutral-500">No timeline data available.</p>;
  }

  const totalDays = daysBetween(start, end);
  const weekLabels = formatWeekLabels(start, totalDays);
  const allTasks = plan.phases.flatMap((phase) => phase.tasks);

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="space-y-4 min-w-[760px] px-2">
        <div className="grid grid-cols-12 text-[11px] font-semibold text-neutral-500">
          <span className="col-span-3">Task</span>
          <span className="col-span-9 grid" style={{ gridTemplateColumns: `repeat(${weekLabels.length}, minmax(0, 1fr))` }}>
            {weekLabels.map((label) => (
              <span key={label} className="text-center px-1">
                {label}
              </span>
            ))}
          </span>
        </div>

        <div className="space-y-3">
          {allTasks.map((task) => {
            const timeline = toOffset(task, start, totalDays);
            return (
              <div key={task.id} className="grid grid-cols-12 items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenPhase?.(task.phaseId, task.id)}
                  className="col-span-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-emerald-50"
                >
                  <p className="text-sm font-semibold text-neutral-800 leading-tight">{task.title}</p>
                  <p className="text-xs text-neutral-500">{timeline.durationDays} days</p>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPhase?.(task.phaseId, task.id)}
                  className="col-span-9 relative h-9 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 text-left"
                >
                  <div
                    className="absolute top-1 bottom-1 rounded-md bg-emerald-500/90 px-2 text-[11px] text-white shadow-sm flex items-center"
                    style={{
                      left: `${timeline.leftPct}%`,
                      width: `${timeline.widthPct}%`,
                    }}
                  >
                    {task.phaseId}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
