import { useT } from "@/lib/i18n";
import { loadSubPresets, saveSubPresets, snapshotSub, type SubPreset } from "@/lib/player/sub-presets";
import { type Settings } from "@/lib/settings";
import { Check, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function styleMatches(s: Settings, p: SubPreset): boolean {
  const v = snapshotSub(s);
  return (Object.keys(p.values) as Array<keyof SubPreset["values"]>).every((k) => v[k] === p.values[k]);
}

export function LooksCluster({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const t = useT();
  const [list, setList] = useState<SubPreset[]>(() => loadSubPresets());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = (next: SubPreset[]) => {
    setList(next);
    saveSubPresets(next);
  };

  useEffect(() => {
    if (selectedId && list.some((p) => p.id === selectedId)) return;
    const match = list.find((p) => styleMatches(settings, p));
    setSelectedId(match ? match.id : null);
  }, [list, selectedId, settings]);

  const selected = list.find((p) => p.id === selectedId) ?? null;
  const dirty = selected ? !styleMatches(settings, selected) : false;
  const isSaved = !!selected && !dirty;

  const apply = (p: SubPreset) => {
    update(p.values);
    setSelectedId(p.id);
  };
  const overrideSelected = () => {
    if (!selected) return;
    commit(list.map((p) => (p.id === selected.id ? { ...p, values: snapshotSub(settings) } : p)));
  };
  const startCreate = () => {
    setDraft("");
    setNaming(true);
  };
  const createNamed = () => {
    const name = draft.trim();
    if (!name) return;
    const id = `${name.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}-${list.length}`;
    commit([...list, { id, name, values: snapshotSub(settings) }]);
    setSelectedId(id);
    setDraft("");
    setNaming(false);
  };

  if (naming) {
    return (
      <div className="flex h-11 shrink-0 items-center gap-1 px-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createNamed();
            if (e.key === "Escape") {
              setNaming(false);
              setDraft("");
            }
          }}
          placeholder={list.length ? t("New look name") : t("Name your look")}
          className="h-8 w-[150px] rounded-[8px] bg-elevated px-2.5 text-[13px] text-ink outline-none ring-1 ring-edge placeholder:text-ink-subtle focus:ring-ink"
        />
        <button
          onClick={createNamed}
          disabled={!draft.trim()}
          className={`ms-0.5 flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors ${
            draft.trim() ? "bg-accent text-canvas hover:brightness-110" : "cursor-default text-ink-subtle/50"
          }`}
        >
          <Check size={13} strokeWidth={2.6} />
          {t("Save")}
        </button>
        <button
          onClick={() => {
            setNaming(false);
            setDraft("");
          }}
          aria-label={t("Cancel")}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-11 items-center gap-1 px-1">
      {list.map((p) => {
        const isSel = p.id === selectedId;
        const matches = styleMatches(settings, p);
        return (
          <PresetTip key={p.id} label={t("Click to apply · Right-click to delete")}>
            <button
              onClick={() => apply(p)}
              onContextMenu={(e) => {
                e.preventDefault();
                commit(list.filter((x) => x.id !== p.id));
                if (selectedId === p.id) setSelectedId(null);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors ${
                matches
                  ? "bg-raised text-ink ring-1 ring-edge"
                  : isSel
                    ? "bg-raised/60 text-ink"
                    : "text-ink-muted hover:bg-raised/60 hover:text-ink"
              }`}
            >
              {p.name}
              {isSel && dirty && (
                <span aria-label={t("unsaved changes")} className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </PresetTip>
        );
      })}

      {list.length > 0 && <span aria-hidden className="mx-0.5 h-5 w-px bg-edge-soft" />}

      <button
        onClick={selected ? (dirty ? overrideSelected : undefined) : startCreate}
        disabled={isSaved}
        title={
          selected
            ? dirty
              ? t("Overwrite {name} with this look", { name: selected.name })
              : t("No unsaved changes")
            : t("Save this look")
        }
        className={`flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-semibold transition-all ${
          isSaved ? "cursor-default text-ink-subtle/55" : "bg-accent text-canvas hover:brightness-110"
        }`}
      >
        {isSaved || selected ? <Check size={13} strokeWidth={2.6} /> : <Plus size={14} strokeWidth={2.6} />}
        {isSaved ? t("Saved") : selected ? t("Override {name}", { name: selected.name }) : t("Save look")}
      </button>

      {selected && (
        <PresetTip label={t("Save as a new look")}>
          <button
            onClick={startCreate}
            aria-label={t("Save as a new look")}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <Plus size={16} />
          </button>
        </PresetTip>
      )}
    </div>
  );
}

function PresetTip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setPos({ top: r.top - 8, left: r.left + r.width / 2 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[330] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-black/90 px-2.5 py-1 text-[12px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}
