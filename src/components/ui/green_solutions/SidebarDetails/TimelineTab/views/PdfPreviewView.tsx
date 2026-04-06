import type { TimelinePlan } from "../types";

interface PdfPreviewViewProps {
  plan: TimelinePlan;
  displayMode?: "sidebar" | "fullscreen";
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PdfPreviewView({
  plan,
  displayMode = "sidebar",
}: PdfPreviewViewProps) {
  const isFullscreen = displayMode === "fullscreen";
  const firstPhase = plan.phases[0];
  const lastPhase = plan.phases[plan.phases.length - 1];
  const totalDays =
    firstPhase && lastPhase
      ? Math.round(
          (lastPhase.endDate.getTime() - firstPhase.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;

  return (
    <article className={isFullscreen ? "mx-auto w-full max-w-5xl bg-white border border-neutral-200 rounded-[28px] p-7 md:p-10 shadow-sm space-y-8" : "mx-auto w-full max-w-3xl bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6"}>
      <header className="space-y-3">
        <p className={isFullscreen ? "text-xs tracking-[0.22em] font-bold uppercase text-neutral-400" : "text-[11px] tracking-[0.18em] font-bold uppercase text-neutral-400"}>
          Overview
        </p>
        <div>
          <h3 className={isFullscreen ? "text-3xl font-black text-neutral-900 leading-tight md:text-4xl" : "text-2xl font-black text-neutral-900 leading-tight"}>
            {plan.objective}
          </h3>
          <p className={isFullscreen ? "text-base text-neutral-500" : "text-sm text-neutral-500"}>{plan.locationLabel}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <div>
            <p className="text-[11px] text-neutral-400">Duration</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>{totalDays} days</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Phases</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>{plan.phases.length}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Generated</p>
            <p className={isFullscreen ? "text-sm font-semibold text-neutral-700" : "text-xs font-semibold text-neutral-700"}>{formatDate(plan.generatedAt)}</p>
          </div>
        </div>
      </header>

      {plan.constraints.length > 0 && (
        <section className="space-y-2">
          <h4 className={isFullscreen ? "text-base font-bold uppercase tracking-[0.15em] text-neutral-500" : "text-sm font-bold uppercase tracking-[0.15em] text-neutral-500"}>
            AI-Aligned Constraints
          </h4>
          <ul className={isFullscreen ? "list-disc pl-6 space-y-2 text-base text-neutral-700" : "list-disc pl-5 space-y-1 text-sm text-neutral-700"}>
            {plan.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h4 className={isFullscreen ? "text-base font-bold uppercase tracking-[0.15em] text-neutral-500" : "text-sm font-bold uppercase tracking-[0.15em] text-neutral-500"}>
          Implementation Timeline
        </h4>

        {plan.phases.map((phase, phaseIndex) => (
          <div key={phase.id} className={isFullscreen ? "border border-neutral-200 rounded-2xl p-6 space-y-3" : "border border-neutral-200 rounded-xl p-4 space-y-2"}>
            <div className="flex items-center justify-between gap-3">
              <h5 className={isFullscreen ? "text-xl font-bold text-neutral-900" : "text-base font-bold text-neutral-900"}>
                {phaseIndex + 1}. {phase.title}
              </h5>
              <span className={isFullscreen ? "text-sm text-neutral-500" : "text-xs text-neutral-500"}>
                {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
              </span>
            </div>

            <p className={isFullscreen ? "text-base leading-7 text-neutral-600" : "text-sm text-neutral-600"}>{phase.subtitle}</p>

            <ul className={isFullscreen ? "list-decimal pl-6 space-y-2 text-base text-neutral-700" : "list-decimal pl-5 space-y-1.5 text-sm text-neutral-700"}>
              {phase.tasks.map((task) => (
                <li key={task.id}>
                  <span className="font-semibold text-neutral-800">{task.title}: </span>
                  {task.description}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
  );
}
