export function BundleSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="harbor-skel min-h-[380px] w-full rounded-md bg-elevated" />
      <div className="flex flex-col gap-8 ps-[9px]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="harbor-skel h-11 w-48 rounded-full bg-elevated" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="harbor-skel h-11 w-28 rounded-full bg-elevated" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="harbor-skel h-4 w-32 rounded bg-elevated" />
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex w-[252px] shrink-0 flex-col gap-2.5">
                <div className="harbor-skel aspect-[16/10] w-full rounded-md bg-elevated" />
                <div className="flex flex-col gap-1.5 px-1">
                  <div className="harbor-skel h-3 w-3/5 rounded bg-elevated" />
                  <div className="harbor-skel h-3 w-2/5 rounded bg-elevated" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
