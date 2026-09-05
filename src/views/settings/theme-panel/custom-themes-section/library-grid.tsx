import { ArrowRight, Check, Copy, FilePlus2, Palette, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ThemePreset } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export type LibraryEntry = {
  theme: ThemePreset;
  category: "Built-in" | "Featured" | "Template" | "Yours";
  removable: boolean;
};

export function LibraryGrid({
  entries,
  activeId,
  onActivate,
  onExport,
  onRemove,
  onCreate,
  onUpload,
}: {
  entries: LibraryEntry[];
  activeId: string;
  onActivate: (id: string) => void;
  onExport: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate?: () => void;
  onUpload?: (file: File) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {entries.map((e) => (
        <LibraryCard
          key={e.theme.id}
          entry={e}
          active={activeId === e.theme.id}
          onActivate={() => onActivate(e.theme.id)}
          onExport={() => onExport(e.theme.id)}
          onRemove={() => onRemove(e.theme.id)}
        />
      ))}
      {onCreate && <CreateTile onCreate={onCreate} />}
      {onUpload && <ImportTile onUpload={onUpload} />}
    </div>
  );
}

function CreateTile({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onCreate}
      className="group relative flex h-full min-h-[252px] flex-col items-start justify-between overflow-hidden rounded-md bg-elevated p-5 text-start transition-colors hover:bg-raised"
      aria-label={t("Build a new theme")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -end-12 -top-12 h-44 w-44 rounded-full opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: "var(--color-accent)" }}
      />
      <div className="relative flex flex-col gap-1.5">
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] bg-accent text-canvas">{t("New")}</span>
        <span className="text-[18px] font-semibold tracking-tight text-ink">
          {t("Build a theme")}
        </span>
        <span className="max-w-[40ch] text-[15.5px] leading-[22px] text-ink-muted">
          {t("Pick a layout, set colors and fonts, save it to your library. No code needed.")}
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-3 self-stretch">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-105"
          style={{ background: "var(--color-accent)", color: "var(--color-canvas)" }}
        >
          <Palette size={20} strokeWidth={2} />
        </span>
        <span className="inline-flex min-h-11 items-center gap-1.5 text-[15.5px] font-semibold text-accent transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
          {t("Open studio")}
          <ArrowRight size={18} strokeWidth={2.2} className="dir-icon" />
        </span>
      </div>
    </button>
  );
}

function ImportTile({ onUpload }: { onUpload: (file: File) => void }) {
  const t = useT();
  const [dragOver, setDragOver] = useState(false);
  const pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".harborstyle,.json,.txt,.harbortheme.json,application/json,text/plain";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) onUpload(f);
    };
    input.click();
  };
  return (
    <button
      type="button"
      onClick={pick}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      className={`group relative flex h-full min-h-[252px] flex-col items-start justify-between overflow-hidden rounded-md border p-5 text-start transition duration-200 ${
        dragOver ? "border-accent bg-accent-soft" : "border-edge-soft bg-canvas hover:bg-canvas"
      }`}
      aria-label={t("Import a theme file")}
    >
      <div className="relative flex flex-col gap-1.5">
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] bg-elevated text-ink-subtle">{t("Have a file?")}</span>
        <span className="text-[18px] font-semibold tracking-tight text-ink">
          {t("Import a theme")}
        </span>
        <span className="max-w-[40ch] text-[15.5px] leading-[22px] text-ink-muted">
          {dragOver
            ? t("Release to add it to your library")
            : t("Drop a theme file here or click to browse.")}
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-3 self-stretch">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-md bg-canvas text-ink-muted transition-colors duration-300 group-hover:text-ink"
          style={{
            transform: dragOver ? "scale(1.08)" : "scale(1)",
            transition:
              "transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 200ms, color 200ms",
          }}
        >
          <FilePlus2 size={20} strokeWidth={2} />
        </span>
        <span className="inline-flex min-h-11 items-center gap-1.5 text-[15.5px] font-semibold text-ink-muted transition-colors group-hover:text-ink">
          {t("Browse files")}
          <ArrowRight size={18} strokeWidth={2.2} className="dir-icon" />
        </span>
      </div>
    </button>
  );
}

function LibraryCard({
  entry,
  active,
  onActivate,
  onExport,
  onRemove,
}: {
  entry: LibraryEntry;
  active: boolean;
  onActivate: () => void;
  onExport: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const { theme, category, removable } = entry;
  const hasImage = !!theme.previewImage;
  const localizedBlurb = category !== "Yours" && theme.blurb ? t(theme.blurb) : theme.blurb;
  const bg =
    theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-md border bg-surface transition-colors ${
        active
          ? "border-accent ring-1 ring-accent/25"
          : "border-edge-soft hover:border-edge hover:bg-elevated"
      }`}
    >
      <div
        className="relative h-36 w-full"
        style={
          hasImage
            ? {
                backgroundImage: `url(${theme.previewImage})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundColor: theme.swatch[0],
              }
            : { background: bg }
        }
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-canvas/40" />
        <CategoryBadge category={category} active={active} />
        {active && (
          <span className="absolute end-3 top-3 gap-1.5 inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] bg-accent text-canvas">
            <Check size={14} strokeWidth={3} /> {t("Active")}
          </span>
        )}
        <SwatchStrip swatch={theme.swatch} />
      </div>
      <div className="flex min-h-[104px] flex-1 flex-col justify-between gap-3 px-4 pb-4 pt-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[16.5px] font-semibold leading-[24px] text-ink">{theme.name}</span>
          {localizedBlurb && (
            <span className="text-[15.5px] leading-[22px] text-ink-subtle">{localizedBlurb}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onActivate}
            className={`h-11 flex-1 rounded-[8px] text-[15.5px] font-semibold transition-opacity ${
              active ? "bg-elevated text-ink" : "bg-ink text-canvas hover:opacity-90"
            }`}
          >
            {active ? t("Active") : t("Apply")}
          </button>
          <ActionBtn label="Copy" onClick={onExport}>
            <Copy size={18} strokeWidth={2.2} />
          </ActionBtn>
          {removable && (
            <ActionBtn label="Remove" onClick={onRemove} danger>
              <Trash2 size={18} strokeWidth={2.2} />
            </ActionBtn>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({
  category,
  active,
}: {
  category: LibraryEntry["category"];
  active: boolean;
}) {
  const t = useT();
  const isFeatured = category === "Featured";
  return (
    <span
      className={`absolute start-3 top-3 inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] ${
        isFeatured ? "bg-canvas text-accent" : "bg-canvas text-ink"
      } ${active ? "opacity-0" : "opacity-100"}`}
    >
      {t(category)}
    </span>
  );
}

function SwatchStrip({ swatch }: { swatch: string[] }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-1.5">
      {swatch.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t(label)}
      title={t(label)}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-canvas text-ink-subtle transition-colors ${
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
