"use client";

export default function SidebarLoadingSkeleton() {
  return (
    <div className="flex w-full flex-col space-y-6 animate-in fade-in duration-300">
      <div className="flex w-full flex-col items-center gap-3">
        <div className="h-6 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        <div className="grid w-full grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-2xl border border-neutral-200 bg-neutral-100/50 p-3 flex flex-col justify-between dark:border-neutral-850 dark:bg-neutral-900/50"
            >
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
                <div className="h-3 w-16 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
              </div>
              <div className="h-5 w-10 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse mt-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-100/50 p-3 dark:border-neutral-850 dark:bg-neutral-900/50">
        <div className="h-3 w-32 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
        <div className="h-4 w-full rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse mt-2" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-40 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
          <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="h-14 w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-100/50 p-4 dark:border-neutral-850 dark:bg-neutral-900/50"
            >
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
                <div className="h-3 w-48 rounded bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
              </div>
              <div className="h-10 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
