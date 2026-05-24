import { CheckCircle2 } from "lucide-react";
import type { TimelinePlan } from "../types";

interface RoadmapViewProps {
  plan: TimelinePlan;
  onOpenPhase?: (phaseId: string, taskId?: string) => void;
  showRevisionBadge?: boolean;
  isFullscreen?: boolean;
}

export default function RoadmapView({
  plan,
  onOpenPhase,
  showRevisionBadge = false,
  isFullscreen = false,
}: RoadmapViewProps) {
  const spacing = isFullscreen ? "space-y-3" : "space-y-5";
  const leftPad = isFullscreen ? "pl-[42px]" : "pl-12";
  const iconSize = isFullscreen ? "h-8 w-8" : "h-10 w-10";
  const iconInner = isFullscreen ? 15 : 18;
  const connectorLeft = isFullscreen ? "left-[16px]" : "left-[21px]";
  const connectorTop = isFullscreen ? "top-[36px]" : "top-11";
  const cardPadding = isFullscreen ? "p-3 sm:p-3" : "p-4";
  const phaseLabel = isFullscreen ? "text-[10px]" : "text-[11px]";
  const titleSize = isFullscreen ? "text-sm sm:text-base" : "text-base";
  const subtitleSize = isFullscreen ? "text-xs sm:text-sm" : "text-sm";
  const taskGap = isFullscreen ? "gap-2" : "gap-2.5";
  const taskPadding = isFullscreen ? "px-2.5 py-2" : "px-2 py-2";
  const checkSize = isFullscreen ? 14 : 15;

  return (
    <div className={spacing}>
      {plan.phases.map((phase, index) => {
        const Icon = phase.icon;
        return (
          <section key={phase.id} className={`relative ${leftPad}`}>
            {index < plan.phases.length - 1 && (
              <div className={`absolute ${connectorLeft} ${connectorTop} h-[calc(100%-1rem)] w-0.5 bg-gradient-to-b from-emerald-300 via-emerald-200 to-neutral-200`} />
            )}

            <div className={`absolute left-0 top-0 ${iconSize} rounded-full border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm`}>
              <Icon size={iconInner} />
            </div>

            <div
              className={`${cardPadding} rounded-2xl border border-neutral-200 bg-white transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50 cursor-pointer ${isFullscreen ? "sm:rounded-3xl" : ""}`}
              onClick={() => onOpenPhase?.(phase.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenPhase?.(phase.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <p className={`${phaseLabel} font-bold tracking-[0.18em] text-neutral-400 uppercase`}>
                  Phase {index + 1}
                </p>
                {isFullscreen && showRevisionBadge ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Revised
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h4 className={`${titleSize} font-bold text-neutral-900`}>{phase.title}</h4>
                {!isFullscreen && showRevisionBadge ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Revised
                  </span>
                ) : null}
              </div>
              <p className={`${subtitleSize} text-neutral-500 mt-1.5 leading-relaxed`}>{phase.subtitle}</p>

              <div className={`mt-4 ${isFullscreen ? "mt-5" : ""}`}>
                <p className={`${isFullscreen ? "text-[11px]" : "text-[10px]"} font-bold uppercase tracking-[0.16em] text-neutral-400 mb-2`}>
                  Work Items
                </p>
                <ul className={`space-y-2 ${isFullscreen ? "sm:space-y-2.5" : ""}`}>
                  {phase.tasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPhase?.(phase.id, task.id);
                        }}
                        className={`flex w-full items-start ${taskGap} rounded-xl ${taskPadding} text-left text-sm text-neutral-700 transition-all duration-150 hover:bg-emerald-50 hover:shadow-sm ${isFullscreen ? "sm:rounded-2xl" : ""}`}
                      >
                        <CheckCircle2 size={checkSize} className="mt-0.5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-semibold text-neutral-800">{task.title}</p>
                          <p className="text-neutral-500 text-xs leading-relaxed mt-0.5">{task.description}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
