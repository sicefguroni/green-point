import type { CostEstimate } from "@/types/green_solutions";
import type { CSSProperties } from "react";
import CostEstimateCard from "../../CostEstimateCard";
import {
  PDF_PREVIEW_HEIGHT_PX,
  PDF_PREVIEW_PADDING_PX,
  PDF_PREVIEW_WIDTH_PX,
} from "../../timelinePdfLayout";
import type { TimelinePdfPlan } from "../../timelinePrintPayload";

interface PdfPreviewViewProps {
  plan: TimelinePdfPlan;
  costEstimate?: CostEstimate | null;
}

const AVOID_PAGE_BREAK_STYLE: CSSProperties = {
  breakInside: "avoid-page" as const,
  pageBreakInside: "avoid" as const,
};

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PdfPreviewView({
  plan,
  costEstimate,
}: PdfPreviewViewProps) {
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
    <article
      className="border border-neutral-200 bg-white space-y-8"
      style={{
        width: `${PDF_PREVIEW_WIDTH_PX}px`,
        minHeight: `${PDF_PREVIEW_HEIGHT_PX}px`,
        padding: `${PDF_PREVIEW_PADDING_PX}px`,
      }}
    >
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">
          Overview
        </p>
        <div className="space-y-1.5">
          <h3 className="text-[40px] font-black leading-tight text-neutral-900">
            {plan.objective}
          </h3>
          <p className="text-base text-neutral-500">{plan.locationLabel}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] text-neutral-400">Duration</p>
            <p className="text-sm font-semibold text-neutral-700">{totalDays} days</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Phases</p>
            <p className="text-sm font-semibold text-neutral-700">{plan.phases.length}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Generated</p>
            <p className="text-sm font-semibold text-neutral-700">{formatDate(plan.generatedAt)}</p>
          </div>
        </div>
      </header>

      {costEstimate && (
        <section className="space-y-4" style={AVOID_PAGE_BREAK_STYLE}>
          <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-neutral-500">
            Grounded Cost Context
          </h4>
          <CostEstimateCard costEstimate={costEstimate} />
        </section>
      )}

      {plan.constraints.length > 0 && (
        <section className="space-y-3" style={AVOID_PAGE_BREAK_STYLE}>
          <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-neutral-500">
            AI-Aligned Constraints
          </h4>
          <ul className="list-disc space-y-2 pl-6 text-base text-neutral-700">
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
          <div key={phase.id} className="space-y-4 rounded-[24px] border border-neutral-200 p-6" style={AVOID_PAGE_BREAK_STYLE}>
            <div className="flex items-center justify-between gap-3">
              <h5 className="text-[32px] font-bold text-neutral-900">
                {phaseIndex + 1}. {phase.title}
              </h5>
              <span className="text-sm text-neutral-500">
                {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
              </span>
            </div>

            <p className="text-base leading-7 text-neutral-600">{phase.subtitle}</p>

            <ul className="list-decimal space-y-2 pl-6 text-base text-neutral-700">
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
