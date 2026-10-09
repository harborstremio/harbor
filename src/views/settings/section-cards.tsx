import { icons } from "./icons";
import { useT } from "@/lib/i18n";
import { SECTION_ICONS } from "./section-icons";
import type { SectionId } from "./shared";

function Glyph({ name, size }: { name: string; size: number }) {
  const Icon = icons[name as keyof typeof icons] ?? icons.Circle;
  return <Icon size={size} strokeWidth={2} />;
}

export function SectionCards({
  sections,
  meta,
  onOpen,
}: {
  sections: SectionId[];
  meta: Record<SectionId, { label: string; sub: string }>;
  onOpen: (id: SectionId) => void;
}) {
  const t = useT();
  return (
    <div className="hset-cards">
      {sections.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className="hset-card"
        >
          <span className="hset-card-icon">
            <Glyph name={SECTION_ICONS[id]} size={21} />
          </span>
          <span className="hset-card-text">
            <span className="hset-card-title">{t(meta[id].label)}</span>
            <span className="hset-card-desc truncate">{t(meta[id].sub)}</span>
          </span>
          <span className="hset-card-chevron" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
