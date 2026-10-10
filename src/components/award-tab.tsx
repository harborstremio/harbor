export function AwardTab({ label, className = "" }: { label: string; className?: string }) {
  if (!label) return null;
  return (
    <span
      className={`inline-flex w-max items-center justify-center gap-1 rounded-[5px] border border-[#b8934a]/85 bg-[#1c1d1d] px-1.5 py-[3px] shadow-[0_2px_9px_rgba(0,0,0,0.55)] ${className}`}
    >
      <img
        src="/awardtab-laurel-l.png"
        alt=""
        draggable={false}
        className="h-[15px] w-auto shrink-0 select-none"
      />
      <span className="whitespace-nowrap text-[9.5px] font-extrabold uppercase leading-none tracking-[0.08em] text-[#ecd188]">
        {label}
      </span>
      <img
        src="/awardtab-laurel-r.png"
        alt=""
        draggable={false}
        className="h-[15px] w-auto shrink-0 select-none"
      />
    </span>
  );
}
