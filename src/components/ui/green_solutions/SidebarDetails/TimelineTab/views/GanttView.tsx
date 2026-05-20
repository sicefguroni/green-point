import type { TimelinePlan, TimelineTask } from "../types";

interface GanttViewProps {
  plan: TimelinePlan;
  onOpenPhase?: (phaseId: string, taskId?: string) => void;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const TASK_COLUMN_WIDTH = 220;
const WEEK_COLUMN_MIN_WIDTH = 58;

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
    return {
      id: labelDate.toISOString(),
      month: labelDate.toLocaleDateString("en-PH", {
        month: "short",
      }),
      day: labelDate.toLocaleDateString("en-PH", {
        day: "numeric",
      }),
      full: labelDate.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
    };
  });
}

function normalizePhaseLabel(phaseId: string) {
  const trimmed = phaseId.trim();
  const numberedPhase = trimmed.match(/^(?:phase|p)[\s_-]*(\d+)$/i);

  if (numberedPhase) {
    return {
      short: `P${numberedPhase[1]}`,
      full: `Phase ${numberedPhase[1]}`,
    };
  }

  const humanized = trimmed
    .replace(/[\s_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return {
    short: humanized,
    full: humanized,
  };
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
  const timelineGridWidth = `${weekLabels.length * WEEK_COLUMN_MIN_WIDTH}px`;
  const layoutColumns = `${TASK_COLUMN_WIDTH}px minmax(${timelineGridWidth}, 1fr)`;
  const phaseTitles = new Map(plan.phases.map((phase) => [phase.id, phase.title]));

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div
        data-export-node="timeline-gantt"
        className="min-w-max space-y-4 px-2"
      >
        <div
          className="grid items-start gap-3 text-[11px] font-semibold text-neutral-500"
          style={{ gridTemplateColumns: layoutColumns }}
        >
          <span className="pt-1">Task</span>
          <span
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${weekLabels.length}, minmax(${WEEK_COLUMN_MIN_WIDTH}px, 1fr))`,
            }}
          >
            {weekLabels.map((label) => (
              <span
                key={label.id}
                className="flex min-w-0 flex-col items-center px-1 text-center leading-none whitespace-nowrap"
                title={label.full}
              >
                <span>{label.month}</span>
                <span className="mt-1 text-[10px] text-neutral-400">{label.day}</span>
              </span>
            ))}
          </span>
        </div>

        <div className="space-y-3">
          {allTasks.map((task) => {
            const timeline = toOffset(task, start, totalDays);
            const phaseLabel = normalizePhaseLabel(task.phaseId);
            const phaseTitle = phaseTitles.get(task.phaseId);
            return (
              <div
                key={task.id}
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: layoutColumns }}
              >
                <button
                  type="button"
                  onClick={() => onOpenPhase?.(task.phaseId, task.id)}
                  className="rounded-xl px-2 py-2 text-left transition-colors hover:bg-emerald-50"
                >
                  <p className="text-sm font-semibold text-neutral-800 leading-tight">{task.title}</p>
                  <p className="text-xs text-neutral-500">{timeline.durationDays} days</p>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPhase?.(task.phaseId, task.id)}
                  className="relative h-9 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 text-left"
                  title={phaseTitle ? `${phaseLabel.full}: ${phaseTitle}` : phaseLabel.full}
                  aria-label={phaseTitle ? `${phaseLabel.full}: ${phaseTitle}` : phaseLabel.full}
                >
                  <div
                    className="absolute top-1 bottom-1 flex items-center rounded-md bg-emerald-500/90 px-2 text-[11px] font-semibold text-white shadow-sm"
                    style={{
                      left: `${timeline.leftPct}%`,
                      width: `${timeline.widthPct}%`,
                    }}
                  >
                    <span className="truncate">{phaseLabel.short}</span>
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
