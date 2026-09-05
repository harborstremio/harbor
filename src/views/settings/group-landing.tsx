import { ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TopGroup } from "./groups";
import type { SectionId } from "./shared";
import { SRow } from "./ui";

export function GroupLanding({
  group,
  meta,
  onOpen,
}: {
  group: TopGroup;
  meta: Record<SectionId, { label: string; sub: string }>;
  onOpen: (id: SectionId) => void;
}) {
  const t = useT();
  return (
    <section className="harbor-settings-section flex flex-col gap-[11px]">
      <div className="flex items-center gap-2 px-0.5">
        <h2 className="harbor-settings-label">{t(group.section)}</h2>
      </div>
      <div className="harbor-settings-group">
        {group.children.map((id) => (
          <SRow
            key={id}
            title={t(meta[id].label)}
            description={t(meta[id].sub)}
            onClick={() => onOpen(id)}
            trailing={
              <ChevronRight
                size={20}
                strokeWidth={2.2}
                className="shrink-0 text-ink-subtle rtl:-scale-x-100"
              />
            }
          />
        ))}
      </div>
    </section>
  );
}
