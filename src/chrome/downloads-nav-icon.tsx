import { useActiveDownloadCount } from "@/lib/download/downloads-store";
import { Download } from "lucide-react";

export function DownloadsNavIcon({ active }: { active: boolean }) {
  const count = useActiveDownloadCount();
  return (
    <span className="relative inline-flex items-center justify-center">
      <Download size={22} strokeWidth={active ? 2.4 : 2} />
      {count > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-[3px] text-[9.5px] font-bold leading-none text-canvas tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
