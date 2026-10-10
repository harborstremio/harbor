export function RowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="harbor-skel h-5 w-44 rounded bg-elevated/30" />
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex w-[148px] shrink-0 flex-col gap-2.5">
            <div className="harbor-skel aspect-[2/3] rounded-xl bg-elevated/30" />
            <div className="harbor-skel h-3 w-3/5 rounded bg-elevated/25" />
            <div className="harbor-skel h-3 w-2/5 rounded bg-elevated/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
