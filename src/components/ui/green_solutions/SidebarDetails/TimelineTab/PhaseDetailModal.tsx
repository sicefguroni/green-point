"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { daysBetween } from "@/lib/timeline/plan";
import { type TimelinePhase } from "./types";

interface PhaseDetailModalProps {
  phase: TimelinePhase | null;
  selectedTaskId?: string | null;
  editable?: boolean;
  onSavePhase?: (phase: TimelinePhase) => void;
  onClose: () => void;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function PhaseDetailModal({
  phase,
  selectedTaskId,
  editable = false,
  onSavePhase,
  onClose,
}: PhaseDetailModalProps) {
  const [draftPhase, setDraftPhase] = useState<TimelinePhase | null>(phase);

  useEffect(() => {
    if (!phase) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, onClose]);

  useEffect(() => {
    setDraftPhase(
      phase
        ? {
            ...phase,
            startDate: new Date(phase.startDate),
            endDate: new Date(phase.endDate),
            tasks: phase.tasks.map((task) => ({
              ...task,
              startDate: new Date(task.startDate),
              endDate: new Date(task.endDate),
            })),
          }
        : null,
    );
  }, [phase]);

  if (!phase || !draftPhase || typeof document === "undefined") {
    return null;
  }

  const Icon = draftPhase.icon;

  const updateTask = (
    taskId: string,
    updater: (
      task: TimelinePhase["tasks"][number],
    ) => TimelinePhase["tasks"][number],
  ) => {
    setDraftPhase((current) => {
      if (!current) return current;

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? updater(task) : task,
        ),
      };
    });
  };

  const handleSave = () => {
    if (!draftPhase) return;
    onSavePhase?.(draftPhase);
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/40 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-[linear-gradient(135deg,rgba(52,168,83,0.08),rgba(255,255,255,0.96))] px-6 py-5">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  {editable ? "Edit Phase" : "Phase Details"}
                </p>
                <h3 className="text-2xl font-bold text-neutral-900">
                  {draftPhase.title}
                </h3>
              </div>
            </div>
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={draftPhase.title}
                  onChange={(event) =>
                    setDraftPhase((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-300"
                  placeholder="Phase title"
                />
                <input
                  value={draftPhase.subtitle}
                  onChange={(event) =>
                    setDraftPhase((current) =>
                      current
                        ? { ...current, subtitle: event.target.value }
                        : current,
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-emerald-300"
                  placeholder="Phase subtitle"
                />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">{draftPhase.subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-800"
            aria-label="Close phase details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 border-b border-neutral-100 px-6 py-5 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
              <CalendarDays size={14} />
              Schedule
            </div>
            {editable ? (
              <div className="mt-2 grid gap-2">
                <input
                  type="date"
                  value={toDateInputValue(draftPhase.startDate)}
                  onChange={(event) =>
                    setDraftPhase((current) =>
                      current
                        ? {
                            ...current,
                            startDate: new Date(
                              `${event.target.value}T00:00:00`,
                            ),
                          }
                        : current,
                    )
                  }
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                />
                <input
                  type="date"
                  value={toDateInputValue(draftPhase.endDate)}
                  onChange={(event) =>
                    setDraftPhase((current) =>
                      current
                        ? {
                            ...current,
                            endDate: new Date(`${event.target.value}T00:00:00`),
                          }
                        : current,
                    )
                  }
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                />
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-neutral-900">
                {formatDate(draftPhase.startDate)} to{" "}
                {formatDate(draftPhase.endDate)}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
              <Clock3 size={14} />
              Duration
            </div>
            <p className="mt-2 text-sm font-semibold text-neutral-900">
              {daysBetween(draftPhase.startDate, draftPhase.endDate)} days
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
              Work Items
            </div>
            <p className="mt-2 text-sm font-semibold text-neutral-900">
              {draftPhase.tasks.length} tasks in this phase
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {draftPhase.tasks.map((task, index) => {
            const isHighlighted = task.id === selectedTaskId;

            return (
              <div
                key={task.id}
                className={`rounded-2xl border px-4 py-4 transition-colors ${
                  isHighlighted
                    ? "border-emerald-300 bg-emerald-50/70"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                      Task {index + 1}
                    </p>
                    {editable ? (
                      <input
                        value={task.title}
                        onChange={(event) =>
                          updateTask(task.id, (currentTask) => ({
                            ...currentTask,
                            title: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base font-bold text-neutral-900 outline-none focus:border-emerald-300"
                      />
                    ) : (
                      <h4 className="mt-1 text-base font-bold text-neutral-900">
                        {task.title}
                      </h4>
                    )}
                  </div>
                  {isHighlighted ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                      Selected
                    </span>
                  ) : null}
                </div>

                {editable ? (
                  <textarea
                    value={task.description}
                    onChange={(event) =>
                      updateTask(task.id, (currentTask) => ({
                        ...currentTask,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm leading-relaxed text-neutral-700 outline-none focus:border-emerald-300"
                  />
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    {task.description}
                  </p>
                )}

                <div className="mt-4 grid gap-3 text-xs text-neutral-500 sm:grid-cols-3">
                  <div>
                    <p className="font-bold uppercase tracking-[0.16em] text-neutral-400">
                      Starts
                    </p>
                    {editable ? (
                      <input
                        type="date"
                        value={toDateInputValue(task.startDate)}
                        onChange={(event) =>
                          updateTask(task.id, (currentTask) => ({
                            ...currentTask,
                            startDate: new Date(
                              `${event.target.value}T00:00:00`,
                            ),
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                      />
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-neutral-800">
                        {formatDate(task.startDate)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-[0.16em] text-neutral-400">
                      Ends
                    </p>
                    {editable ? (
                      <input
                        type="date"
                        value={toDateInputValue(task.endDate)}
                        onChange={(event) =>
                          updateTask(task.id, (currentTask) => ({
                            ...currentTask,
                            endDate: new Date(`${event.target.value}T00:00:00`),
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                      />
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-neutral-800">
                        {formatDate(task.endDate)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-[0.16em] text-neutral-400">
                      Duration
                    </p>
                    <p className="mt-1 text-sm font-semibold text-neutral-800">
                      {daysBetween(task.startDate, task.endDate)} days
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {editable ? (
          <div className="flex items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Phase Changes</Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
