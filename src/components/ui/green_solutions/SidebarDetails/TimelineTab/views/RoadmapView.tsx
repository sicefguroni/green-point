import { CheckCircle2 } from "lucide-react";
import type { TimelinePlan } from "../types";

interface RoadmapViewProps {
  plan: TimelinePlan;
}

export default function RoadmapView({ plan }: RoadmapViewProps) {
  return (
    <div className="space-y-5">
      {plan.phases.map((phase, index) => {
        const Icon = phase.icon;
        return (
          <section key={phase.id} className="relative pl-12">
            {index < plan.phases.length - 1 && (
              <div className="absolute left-[21px] top-11 h-[calc(100%-1rem)] w-0.5 bg-neutral-200" />
            )}

            <div className="absolute left-0 top-0 h-10 w-10 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Icon size={18} />
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-bold tracking-[0.18em] text-neutral-400 uppercase">
                Phase {index + 1}
              </p>
              <h4 className="mt-1 text-base font-bold text-neutral-900">{phase.title}</h4>
              <p className="text-sm text-neutral-500 mt-1">{phase.subtitle}</p>

              <ul className="mt-4 space-y-2">
                {phase.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5 text-sm text-neutral-700">
                    <CheckCircle2 size={15} className="mt-0.5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-neutral-800">{task.title}</p>
                      <p className="text-neutral-500 text-xs leading-relaxed">{task.description}</p>
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
