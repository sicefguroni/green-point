export default function HomeDashboardLoading() {
  return (
    <main className="relative flex min-h-screen max-w-screen flex-col bg-neutral-100 font-roboto">
      <div className="h-16 w-full border-b border-neutral-200 bg-white/80 animate-pulse" />
      <div className="relative w-full flex flex-col overflow-hidden px-4 md:px-10 py-32 gap-10">
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="h-3 w-32 rounded bg-neutral-200 animate-pulse" />
          <div className="h-10 w-64 rounded-lg bg-neutral-200 animate-pulse" />
          <div className="h-4 w-full max-w-md rounded bg-neutral-200/80 animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-white border border-neutral-100 shadow-sm animate-pulse"
            />
          ))}
        </div>
        <div className="h-[420px] w-full rounded-xl border border-neutral-200 bg-white animate-pulse" />
      </div>
    </main>
  );
}
