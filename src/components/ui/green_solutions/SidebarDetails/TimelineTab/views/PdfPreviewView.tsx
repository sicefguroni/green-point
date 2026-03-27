import type { TimelinePlan } from "../types";

interface PdfPreviewViewProps {
  plan: TimelinePlan;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PdfPreviewView({ plan }: PdfPreviewViewProps) {
  return (
    <article className="mx-auto w-full max-w-3xl bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] tracking-[0.18em] font-bold uppercase text-neutral-400">
          GreenPoint Project Plan
        </p>
        <h3 className="text-2xl font-black text-neutral-900 leading-tight">{plan.objective}</h3>
        <p className="text-sm text-neutral-500">Location: {plan.locationLabel}</p>
        <p className="text-xs text-neutral-400">Generated: {formatDate(plan.generatedAt)}</p>
      </header>

      {plan.constraints.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-neutral-500">
            AI-Aligned Constraints
          </h4>
          <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700">
            {plan.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-neutral-500">
          Implementation Timeline
        </h4>

        {plan.phases.map((phase, phaseIndex) => (
          <div key={phase.id} className="border border-neutral-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h5 className="text-base font-bold text-neutral-900">
                {phaseIndex + 1}. {phase.title}
              </h5>
              <span className="text-xs text-neutral-500">
                {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
              </span>
            </div>

            <p className="text-sm text-neutral-600">{phase.subtitle}</p>

            <ul className="list-decimal pl-5 space-y-1.5 text-sm text-neutral-700">
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
