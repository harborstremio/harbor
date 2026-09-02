import { Check, Copy, FilePlus2, Palette, Trash2 } from "lucide-react";
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <span className="inline-flex w-fit items-center rounded-[3px] bg-accent px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-canvas">
          {t("New")}
        </span>
        <span className="text-[18px] font-semibold tracking-tight text-ink">
          {t("Build a theme")}
        </span>
        <span className="max-w-[24ch] text-[12.5px] leading-snug text-ink-muted">
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
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
          {t("Open studio")} →
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
        <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
          {t("Have a file?")}
        </span>
        <span className="text-[18px] font-semibold tracking-tight text-ink">
          {t("Import a theme")}
        </span>
        <span className="max-w-[24ch] text-[12.5px] leading-snug text-ink-muted">
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
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-muted transition-colors group-hover:text-ink">
          {t("Browse files")} →
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />
        <CategoryBadge category={category} active={active} />
        {active && (
          <span className="absolute end-3 top-3 flex h-7 items-center gap-1 rounded-[3px] bg-accent px-2.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-canvas">
            <Check size={12} strokeWidth={3} /> {t("Active")}
          </span>
        )}
        <SwatchStrip swatch={theme.swatch} />
      </div>
      <div className="flex min-h-[88px] flex-1 flex-col justify-between gap-2 px-4 pb-3 pt-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14.5px] font-semibold text-ink">{theme.name}</span>
          {localizedBlurb && (
            <span className="line-clamp-2 text-[11.5px] leading-snug text-ink-subtle">
              {localizedBlurb}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onActivate}
            className={`h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-opacity ${
              active ? "bg-elevated text-ink" : "bg-ink text-canvas hover:opacity-90"
            }`}
          >
            {active ? t("Active") : t("Apply")}
          </button>
          <ActionBtn label="Copy" onClick={onExport}>
            <Copy size={12} strokeWidth={2.2} />
          </ActionBtn>
          {removable && (
            <ActionBtn label="Remove" onClick={onRemove} danger>
              <Trash2 size={12} strokeWidth={2.2} />
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
      className={`absolute start-3 top-3 flex items-center gap-1 rounded-[3px] px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.2em] ${
        isFeatured ? "bg-canvas text-accent" : "bg-canvas text-ink/85"
      } ${active ? "opacity-0" : "opacity-100"}`}
    >
      {t(category)}
    </span>
  );
}

function SwatchStrip({ swatch }: { swatch: string[] }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex h-1.5">
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
      className={`flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-ink-subtle transition-colors ${
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
