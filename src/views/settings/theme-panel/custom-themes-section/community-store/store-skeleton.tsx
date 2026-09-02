export function StoreSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="harbor-skel min-h-[380px] w-full rounded-md bg-elevated" />

      <div className="flex gap-2 ps-[9px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="harbor-skel h-10 w-32 shrink-0 rounded-full bg-elevated" />
        ))}
      </div>

      {[0, 1].map((r) => (
        <div key={r} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 ps-[9px]">
            <div className="harbor-skel h-3.5 w-40 rounded-md bg-elevated" />
            <div className="harbor-skel h-3 w-56 rounded-md bg-elevated" />
          </div>
          <div className="grid grid-flow-col auto-cols-[252px] gap-5 overflow-hidden ps-[9px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                <div className="harbor-skel aspect-[16/10] w-full rounded-md bg-elevated" />
                <div className="flex flex-col gap-1.5 px-1">
                  <div className="harbor-skel h-3 w-3/5 rounded bg-elevated" />
                  <div className="harbor-skel h-3 w-2/5 rounded bg-elevated" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
