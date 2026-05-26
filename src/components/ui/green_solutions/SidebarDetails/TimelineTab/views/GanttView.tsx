import type { TimelinePlan, TimelineTask } from "../types";

interface GanttViewProps {
  plan: TimelinePlan;
  onOpenPhase?: (phaseId: string, taskId?: string) => void;
  isFullscreen?: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const TASK_COLUMN_WIDTH = 250;
const TASK_COLUMN_WIDTH_FULLSCREEN = 360;
const WEEK_COLUMN_MIN_WIDTH = 62;
const WEEK_COLUMN_MIN_WIDTH_FULLSCREEN = 80;

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

export default function GanttView({ plan, onOpenPhase, isFullscreen = false }: GanttViewProps) {
  const start = plan.phases[0]?.startDate;
  const end = plan.phases[plan.phases.length - 1]?.endDate;

  if (!start || !end) {
    return <p className="text-sm text-neutral-500">No timeline data available.</p>;
  }

  const totalDays = daysBetween(start, end);
  const weekLabels = formatWeekLabels(start, totalDays);
  const allTasks = plan.phases.flatMap((phase) => phase.tasks);
  const taskColWidth = isFullscreen ? TASK_COLUMN_WIDTH_FULLSCREEN : TASK_COLUMN_WIDTH;
  const weekColWidth = isFullscreen ? WEEK_COLUMN_MIN_WIDTH_FULLSCREEN : WEEK_COLUMN_MIN_WIDTH;
  const timelineGridWidth = `${weekLabels.length * weekColWidth}px`;
  const layoutColumns = `${taskColWidth}px minmax(${timelineGridWidth}, 1fr)`;
  const phaseTitles = new Map(plan.phases.map((phase) => [phase.id, phase.title]));

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div
        data-export-node="timeline-gantt"
        className={`min-w-max ${isFullscreen ? "space-y-5 px-3" : "space-y-4 px-2"}`}
      >
        <div
          className={`grid items-start gap-3 font-semibold text-neutral-500 ${isFullscreen ? "text-xs" : "text-[11px]"}`}            style={{ gridTemplateColumns: layoutColumns }}
          >
            <span className={`pt-1 ${isFullscreen ? "text-xs" : "text-[11px]"}`}>Task</span>
            <span
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${weekLabels.length}, minmax(${weekColWidth}px, 1fr))`,
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

        <div className={isFullscreen ? "space-y-5" : "space-y-4"}>
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
                  className={`rounded-xl px-2 py-2 text-left transition-all duration-150 hover:bg-emerald-50 hover:shadow-sm ${isFullscreen ? "sm:rounded-2xl sm:px-3 sm:py-2.5" : ""}`}
                >
                  <p className={`font-semibold text-neutral-800 leading-tight ${isFullscreen ? "text-sm sm:text-base" : "text-sm"}`}>{task.title}</p>
                  <p className={`text-neutral-500 ${isFullscreen ? "text-xs sm:text-sm" : "text-xs"}`}>{timeline.durationDays} days</p>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPhase?.(task.phaseId, task.id)}
                  className={`relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 text-left ${isFullscreen ? "h-10 sm:h-11" : "h-9"}`}
                  title={phaseTitle ? `${phaseLabel.full}: ${phaseTitle}` : phaseLabel.full}
                  aria-label={phaseTitle ? `${phaseLabel.full}: ${phaseTitle}` : phaseLabel.full}
                >
                  <div
                    className={`absolute top-1 bottom-1 flex items-center rounded-md bg-gradient-to-r from-emerald-500 to-emerald-400 px-2 font-semibold text-white shadow-sm ${isFullscreen ? "text-xs sm:text-sm sm:rounded-lg" : "text-[11px]"}`}
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
