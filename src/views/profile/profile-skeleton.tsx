const SKEL_CSS = `
.harbor-skel {
  background: linear-gradient(90deg, var(--color-elevated) 25%, var(--color-raised) 38%, var(--color-elevated) 62%);
  background-size: 300% 100%;
  animation: harbor-skel-sweep 1.4s ease-in-out infinite;
}
@keyframes harbor-skel-sweep {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-skel { animation: none; }
}
`;

export function ProfileSkeleton() {
  return (
    <div className="h-full overflow-y-auto" aria-hidden>
      <style>{SKEL_CSS}</style>

      <header className="relative w-full overflow-hidden">
        <div className="harbor-skel h-48 w-full sm:h-60" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-48 sm:h-60"
          style={{ background: "linear-gradient(to bottom, transparent 28%, var(--color-canvas))" }}
        />
        <div className="relative mx-auto -mt-20 w-full max-w-6xl px-6 pb-6 lg:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
            <div className="harbor-skel h-[124px] w-[124px] shrink-0 rounded-full ring-4 ring-canvas" />
            <div className="min-w-0 flex-1 space-y-3 pb-1">
              <div className="harbor-skel h-8 w-64 max-w-full rounded-md" />
              <div className="harbor-skel h-4 w-48 max-w-full rounded-lg" />
              <div className="harbor-skel h-4 w-80 max-w-full rounded-lg" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="harbor-skel h-11 w-28 rounded-md" />
              <div className="harbor-skel h-11 w-32 rounded-md" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="harbor-skel h-[68px] rounded-lg" />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <div className="harbor-skel h-60 rounded-[16px]" />
            <div className="harbor-skel h-44 rounded-[16px]" />
            <div className="harbor-skel h-28 rounded-[16px]" />
            <div className="harbor-skel h-48 rounded-[16px]" />
          </div>
          <div className="space-y-6">
            <div className="harbor-skel h-72 rounded-[16px]" />
            <div className="harbor-skel h-56 rounded-[16px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
