import { useT } from "@/lib/i18n";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ListOrdered, Pencil, Sparkles, X, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RowControls({
  name,
  hidden,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  onRename,
  onResetName,
  isRenamed,
  numeralsActive,
  canNumerals,
  onToggleNumerals,
  heroActive,
  canHero,
  onToggleHero,
  onDelete,
  kids,
}: {
  name: string;
  hidden: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
  onRename: (next: string) => void;
  onResetName: () => void;
  isRenamed: boolean;
  numeralsActive?: boolean;
  canNumerals?: boolean;
  onToggleNumerals?: () => void;
  heroActive?: boolean;
  canHero?: boolean;
  onToggleHero?: () => void;
  onDelete?: () => void;
  kids?: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(name);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, name]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    setEditing(false);
  };

  if (kids) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/75 p-2.5 ring-1 ring-[#1f8f88]/15 backdrop-blur-sm">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-[#1f8f88]/30 bg-white px-4 text-[18px] font-bold text-[#0e3a43] outline-none focus:border-[#1f8f88]"
          />
        ) : (
          <span className="ms-2 min-w-0 flex-1 truncate text-[18px] font-extrabold text-[#0e3a43]">{name}</span>
        )}
        {editing ? (
          <>
            <KidCtrl icon={<Check size={22} strokeWidth={2.6} />} label={t("Save")} onClick={commit} primary />
            <KidCtrl icon={<X size={22} strokeWidth={2.6} />} label={t("Cancel")} onClick={() => setEditing(false)} />
          </>
        ) : (
          <>
            <KidCtrl
              icon={<ArrowUp size={22} strokeWidth={2.6} />}
              label={t("Up")}
              onClick={onMoveUp}
              disabled={!canMoveUp}
            />
            <KidCtrl
              icon={<ArrowDown size={22} strokeWidth={2.6} />}
              label={t("Down")}
              onClick={onMoveDown}
              disabled={!canMoveDown}
            />
            <KidCtrl
              icon={hidden ? <EyeOff size={22} strokeWidth={2.6} /> : <Eye size={22} strokeWidth={2.6} />}
              label={hidden ? t("Show") : t("Hide")}
              onClick={onToggleHidden}
              active={hidden}
            />
            <KidCtrl
              icon={<Pencil size={20} strokeWidth={2.6} />}
              label={t("Rename")}
              onClick={() => setEditing(true)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-edge-soft bg-canvas/60 px-2 py-1.5 text-[12px]">
      <button
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title={t("Move up")}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
      >
        <ArrowUp size={14} strokeWidth={2.2} />
      </button>
      <button
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title={t("Move down")}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
      >
        <ArrowDown size={14} strokeWidth={2.2} />
      </button>
      <button
        onClick={onToggleHidden}
        title={hidden ? t("Show row") : t("Hide row")}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
          hidden ? "bg-danger/15 text-danger hover:bg-danger/25" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {hidden ? <EyeOff size={14} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}
      </button>
      {onToggleNumerals && (
        <button
          onClick={onToggleNumerals}
          disabled={!canNumerals && !numeralsActive}
          title={
            numeralsActive
              ? t("Show as a normal row")
              : canNumerals
                ? t("Show as a Top 10 with big numerals")
                : t("Needs at least 10 titles for the Top 10 look")
          }
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
            numeralsActive
              ? "bg-accent/15 text-accent hover:bg-accent/25"
              : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          <ListOrdered size={14} strokeWidth={2.2} />
        </button>
      )}
      {onToggleHero && (
        <button
          onClick={onToggleHero}
          disabled={!canHero && !heroActive}
          title={
            heroActive
              ? t("Stop feeding the hero carousel (back to automatic)")
              : canHero
                ? t("Feature this catalog in the hero carousel")
                : t("Needs artwork-rich titles to feed the hero")
          }
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
            heroActive ? "bg-accent/15 text-accent hover:bg-accent/25" : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          <Sparkles size={14} strokeWidth={2.2} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title={t("Delete custom source")}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-danger/80 transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
      )}
      <div className="mx-1 h-5 w-px bg-edge-soft" />
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 rounded-md border border-edge bg-elevated px-2 py-1 text-[13px] font-medium text-ink outline-none focus:border-ink-subtle"
          />
          <button
            onClick={commit}
            title={t("Save")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-accent transition-colors hover:bg-raised"
          >
            <Check size={14} strokeWidth={2.4} />
          </button>
          <button
            onClick={() => setEditing(false)}
            title={t("Cancel")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
          {isRenamed && (
            <button
              onClick={onResetName}
              title={t("Reset to original name")}
              className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent/25"
            >
              {t("Renamed")}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            title={t("Rename row")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Pencil size={13} strokeWidth={2.2} />
          </button>
        </>
      )}
    </div>
  );
}

function KidCtrl({
  icon,
  label,
  onClick,
  disabled,
  active,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-extrabold transition active:scale-95 disabled:opacity-30 ${
        primary
          ? "bg-[#1f8f88] text-white"
          : active
            ? "bg-amber-400 text-[#0e3a43]"
            : "bg-[#eaf6f5] text-[#0e3a43] hover:bg-[#d4eeec]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
