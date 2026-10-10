import { Check, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Linkify } from "@/components/linkify";
import { useT } from "@/lib/i18n";

const ANCHOR = "absolute bottom-[80%] left-[100%] z-30";
const BUBBLE =
  "relative max-w-[240px] rounded-[16px] bg-elevated px-3 py-1.5 text-[13px] leading-snug text-ink shadow-lg ring-1 ring-edge-soft";

function Tail() {
  return (
    <>
      <span
        aria-hidden
        className="absolute -bottom-1 left-2 -z-10 h-2.5 w-2.5 rounded-full bg-elevated ring-1 ring-edge-soft"
      />
      <span
        aria-hidden
        className="absolute -bottom-2.5 left-0.5 -z-10 h-1.5 w-1.5 rounded-full bg-elevated ring-1 ring-edge-soft"
      />
    </>
  );
}

export function StatusBubble({
  slogan,
  isOwner,
  onSave,
}: {
  slogan?: string;
  isOwner: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slogan ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(slogan ?? "");
  }, [slogan]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async (next: string) => {
    setBusy(true);
    setError(false);
    try {
      await onSave(next.trim());
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const trimmed = value.trim();

  if (editing) {
    return (
      <div className={`${ANCHOR} w-[240px]`}>
        <div className={`${BUBBLE} w-full`}>
          <div className="flex items-center gap-1.5">
            <input
              ref={ref}
              value={value}
              maxLength={100}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commit(value);
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={t("What's on your mind?")}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
            />
            <button
              type="button"
              aria-label={t("Save status")}
              disabled={busy}
              onClick={() => void commit(value)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-success transition-colors hover:bg-success/12 disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={2.8} />}
            </button>
            {trimmed && (
              <button
                type="button"
                aria-label={t("Clear status")}
                disabled={busy}
                onClick={() => {
                  setValue("");
                  void commit("");
                }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-danger disabled:opacity-40"
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10.5px]">
            <span className={error ? "text-danger" : "text-ink-subtle"}>
              {error ? t("Try again") : t("Enter to save")}
            </span>
            <span className="tabular-nums text-ink-subtle">{value.length}/100</span>
          </div>
        </div>
        <Tail />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className={ANCHOR}>
        <div className={`${BUBBLE} whitespace-nowrap ${slogan ? "" : "text-ink-subtle"}`}>
          {slogan ? (
            <span className="block max-w-[216px] truncate">
              <Linkify text={slogan} />
            </span>
          ) : (
            t("No status")
          )}
        </div>
        <Tail />
      </div>
    );
  }

  return (
    <div className={ANCHOR}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${BUBBLE} whitespace-nowrap text-start transition-colors hover:bg-raised ${
          slogan ? "" : "text-ink-subtle"
        }`}
      >
        {slogan ? (
          <span className="block max-w-[216px] truncate">{slogan}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Plus size={13} strokeWidth={2.4} /> {t("Add status")}
          </span>
        )}
      </button>
      <Tail />
    </div>
  );
}
