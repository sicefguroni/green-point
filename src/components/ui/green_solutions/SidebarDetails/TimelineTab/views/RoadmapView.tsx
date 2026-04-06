import { CheckCircle2 } from "lucide-react";
import type { TimelineBadge, TimelinePlan } from "../types";

interface RoadmapViewProps {
  plan: TimelinePlan;
  displayMode?: "sidebar" | "fullscreen";
}

export default function RoadmapView({
  plan,
  displayMode = "sidebar",
}: RoadmapViewProps) {
  const isFullscreen = displayMode === "fullscreen";

  const badgeClassNames: Record<TimelineBadge["tone"], string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    info: "bg-sky-50 text-sky-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };

  const firstPhase = plan.phases[0];
  const lastPhase = plan.phases[plan.phases.length - 1];
  const totalDays =
    firstPhase && lastPhase
      ? Math.round(
          (lastPhase.endDate.getTime() - firstPhase.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;
  const generatedLabel = plan.generatedAt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={isFullscreen ? "space-y-8" : "space-y-5"}>
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
      {plan.phases.map((phase, index) => {
        const Icon = phase.icon;
        return (
          <section key={phase.id} className={isFullscreen ? "relative pl-16 md:pl-20" : "relative pl-12"}>
            {index < plan.phases.length - 1 && (
              <div
                className={isFullscreen
                  ? "absolute left-[29px] top-14 h-[calc(100%-1.5rem)] w-0.5 bg-neutral-200 md:left-[37px]"
                  : "absolute left-[21px] top-11 h-[calc(100%-1rem)] w-0.5 bg-neutral-200"}
              />
            )}

            <div
              className={isFullscreen
                ? "absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 md:h-[4.5rem] md:w-[4.5rem]"
                : "absolute left-0 top-0 h-10 w-10 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center"}
            >
              <Icon size={isFullscreen ? 24 : 18} />
            </div>

            <div className={isFullscreen ? "rounded-[28px] border border-neutral-200 bg-white p-6 md:p-7 shadow-sm" : "rounded-2xl border border-neutral-200 bg-white p-4"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className={isFullscreen ? "text-xs font-bold tracking-[0.22em] text-neutral-400 uppercase" : "text-[11px] font-bold tracking-[0.18em] text-neutral-400 uppercase"}>
                  Phase {index + 1}
                </p>

                <div className="flex flex-wrap gap-2">
                  {phase.badges?.map((badge) => (
                    <span
                      key={`${phase.id}-${badge.label}`}
                      className={`${badgeClassNames[badge.tone]} rounded-full px-2.5 py-1 text-[11px] font-semibold ${isFullscreen ? "md:text-xs" : ""}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>

              <h4 className={isFullscreen ? "mt-2 text-lg font-bold text-neutral-900 md:text-[1.35rem]" : "mt-1 text-base font-bold text-neutral-900"}>
                {phase.title}
              </h4>
              <p className={isFullscreen ? "mt-2 text-sm leading-6 text-neutral-500 md:text-base" : "text-sm text-neutral-500 mt-1"}>
                {phase.subtitle}
              </p>

              {phase.approvalNote && (
                <div className={isFullscreen ? "mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600" : "mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600"}>
                  <p className="font-medium text-neutral-700">{phase.approvalNote}</p>
                  {plan.reviewerNotes && (
                    <p className={isFullscreen ? "mt-1 leading-relaxed text-neutral-500" : "mt-1 leading-relaxed text-neutral-500"}>
                      Reviewer note: {plan.reviewerNotes}
                    </p>
                  )}
                  {plan.threadId && (
                    <p className="mt-1 text-neutral-400">Thread {plan.threadId.slice(0, 8)}</p>
                  )}
                </div>
              )}

              <ul className={isFullscreen ? "mt-5 space-y-3" : "mt-4 space-y-2"}>
                {phase.tasks.map((task) => (
                  <li
                    key={task.id}
                    className={isFullscreen
                      ? "flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700 md:text-base"
                      : "flex items-start gap-2.5 text-sm text-neutral-700"}
                  >
                    <CheckCircle2 size={isFullscreen ? 18 : 15} className="mt-0.5 text-emerald-600 shrink-0" />
                    <div>
                      <p className={isFullscreen ? "font-semibold text-neutral-800 md:text-[1rem]" : "font-semibold text-neutral-800"}>
                        {task.title}
                      </p>
                      <p className={isFullscreen ? "mt-1 text-sm leading-relaxed text-neutral-500 md:text-[0.95rem]" : "text-neutral-500 text-xs leading-relaxed"}>
                        {task.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
