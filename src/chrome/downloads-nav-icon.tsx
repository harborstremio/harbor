import { NavGlyph } from "@/components/icons/nav-glyph";
import { useActiveDownloadCount } from "@/lib/download/downloads-store";

export function DownloadsNavIcon(_props: { active: boolean }) {
  const count = useActiveDownloadCount();
  return (
    <span className="relative inline-flex items-center justify-center">
      <NavGlyph name="download" className="h-[26px] w-[26px] p-[2px]" />
      {count > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-[3px] text-[9.5px] font-bold leading-none text-canvas tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
