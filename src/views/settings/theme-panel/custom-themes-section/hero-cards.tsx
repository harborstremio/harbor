import { ArrowRight, Check, FileDown, Library, Palette } from "lucide-react";
import type { ReactNode } from "react";
import type { ThemePreset } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Fit } from "./community-store/market/fit";
import { tokensFromPreset } from "./community-store/market/fit-palette";

export function HeroCards({
  onOpenLibrary,
  onOpenStudio,
  onImport,
  libraryCount,
  previewThemes,
  importedNotice,
}: {
  onOpenLibrary: () => void;
  onOpenStudio: () => void;
  onImport: () => void;
  libraryCount: number;
  previewThemes: ThemePreset[];
  importedNotice?: string | null;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <BrowseHero
        themes={previewThemes}
        count={libraryCount}
        imported={importedNotice}
        onClick={onOpenLibrary}
      />
      <div className="flex flex-col gap-4">
        <ActionCard
          visual={<PaletteVisual />}
          icon={<Palette size={16} strokeWidth={2} />}
          title={t("Build a theme")}
          body={t("Colors, layout, and fonts. No code.")}
          cta={t("Open studio")}
          onClick={onOpenStudio}
        />
        <ActionCard
          visual={<ImportVisual />}
          icon={<FileDown size={16} strokeWidth={2} />}
          title={t("Import a theme")}
          body={t("Got one a friend shared? Drop it in.")}
          cta={t("Choose file")}
          onClick={onImport}
        />
      </div>
    </div>
  );
}

const DECK = [
  "z-0 [transform:translateX(-34%)_rotate(-9deg)] group-hover/hero:[transform:translateX(-40%)_rotate(-12deg)]",
  "z-20 group-hover/hero:-translate-y-1.5",
  "z-0 [transform:translateX(34%)_rotate(9deg)] group-hover/hero:[transform:translateX(40%)_rotate(12deg)]",
];

function ThemeDeck({ themes }: { themes: ThemePreset[] }) {
  const shown = themes
    .slice()
    .sort((a, b) => (b.previewImage ? 1 : 0) - (a.previewImage ? 1 : 0))
    .slice(0, 3);
  if (shown.length === 0) return <div className="h-full w-full bg-elevated" />;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {shown.map((t, i) => (
        <span
          key={t.id}
          className={`absolute aspect-[16/10] w-[46%] overflow-hidden rounded-md harbor-float transition-transform duration-300 ease-out motion-reduce:transition-none ${DECK[i]}`}
        >
          <Fit
            kind="theme"
            tokens={tokensFromPreset(t)}
            cover={t.previewImage ?? t.background?.image ?? null}
          />
        </span>
      ))}
    </div>
  );
}

function BrowseHero({
  themes,
  count,
  imported,
  onClick,
}: {
  themes: ThemePreset[];
  count: number;
  imported?: string | null;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/hero relative flex min-h-[252px] flex-col overflow-hidden rounded-md bg-elevated text-start outline-none transition-colors duration-200 hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative flex-1 overflow-hidden bg-canvas">
        <ThemeDeck themes={themes} />
        {imported && (
          <span className="absolute end-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-[3px] bg-canvas px-2.5 py-1 text-[11.5px] font-semibold text-ink">
            <Check size={12} strokeWidth={2.8} className="text-success" />
            {t("{name} added", { name: imported })}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-edge-soft p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
            <Library size={18} strokeWidth={2} className="text-ink-subtle" /> {t("Theme Library")}
          </span>
          <span className="text-[13px] text-ink-muted">
            {count === 1
              ? t("Browse 1 theme. Apply in one click.")
              : t("Browse all {count} themes. Apply in one click.", { count })}
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink transition-transform group-hover/hero:translate-x-0.5 rtl:group-hover/hero:-translate-x-0.5">
          {t("Open library")}
          <ArrowRight size={14} strokeWidth={2.2} className="dir-icon" />
        </span>
      </div>
    </button>
  );
}

function ActionCard({
  visual,
  icon,
  title,
  body,
  cta,
  onClick,
}: {
  visual: ReactNode;
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/act relative flex flex-1 flex-col overflow-hidden rounded-md bg-elevated text-start outline-none transition-colors duration-200 hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative h-[68px] shrink-0 overflow-hidden border-b border-edge-soft bg-canvas">
        {visual}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-ink">
          <span className="text-ink-subtle">{icon}</span>
          {title}
        </span>
        <span className="text-[12.5px] leading-snug text-ink-muted">{body}</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[12.5px] font-semibold text-ink transition-transform group-hover/act:translate-x-0.5 rtl:group-hover/act:-translate-x-0.5">
          {cta}
          <ArrowRight size={14} strokeWidth={2.2} className="dir-icon" />
        </span>
      </div>
    </button>
  );
}

const PALETTE_BARS = ["bg-canvas", "bg-surface", "bg-elevated", "bg-raised", "bg-accent"];

function PaletteVisual() {
  return (
    <div className="flex h-full w-full items-center gap-1.5 px-4">
      {PALETTE_BARS.map((c, i) => (
        <span
          key={i}
          className={`h-9 flex-1 rounded-[3px] transition-transform duration-300 ease-in-out group-hover/act:-translate-y-0.5 motion-reduce:transition-none ${c}`}
          style={{ transitionDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

function ImportVisual() {
  const t = useT();
  return (
    <div className="flex h-full w-full items-center justify-center px-4">
      <div className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-edge-soft text-ink-subtle transition-colors group-hover/act:text-ink-muted">
        <FileDown size={16} strokeWidth={2} />
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em]">
          {t("Drop a {extension}", { extension: ".harborstyle" })}
        </span>
      </div>
    </div>
  );
}
