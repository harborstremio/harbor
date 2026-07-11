import { useT } from "@/lib/i18n";
import { detectSource } from "@/lib/lists/detect";
import { sourceLabel } from "@/lib/lists/types";
import { useMemo, useState } from "react";

import { SOURCE_DOT } from "./source-dot";

export function AddListForm({
  initialRef = "",
  initialName = "",
  submitLabel,
  hideCancel = false,
  onCancel,
  onSubmit,
}: {
  initialRef?: string;
  initialName?: string;
  submitLabel: string;
  hideCancel?: boolean;
  onCancel?: () => void;
  onSubmit: (value: { ref: string; name: string }) => void;
}) {
  const t = useT();
  const [ref, setRef] = useState(initialRef);
  const [name, setName] = useState(initialName);

  const trimmed = ref.trim();
  const detected = useMemo(() => (trimmed ? detectSource(trimmed) : null), [trimmed]);

  const submit = () => {
    if (!detected) return;
    onSubmit({ ref: trimmed, name: name.trim() });
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("List URL or ID")}
        </span>
        <input
          autoFocus
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("Paste a Trakt, MDBList, TMDB, Letterboxd, IMDb, or MAL list URL")}
          spellCheck={false}
          className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 font-mono text-[11.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
        />
      </label>

      <div className="min-h-[22px]">
        {detected ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-edge-soft">
              <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_DOT[detected.source]}`} />
              {t("{source} list detected", { source: sourceLabel(detected.source) })}
            </span>
            <span className="truncate text-[10.5px] text-ink-subtle">{detected.ref}</span>
          </div>
        ) : trimmed ? (
          <p className="text-[11px] text-ink-subtle">{t("Keep typing, or paste the full list URL.")}</p>
        ) : null}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Name (optional)")}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("My list")}
          className="h-10 rounded-lg border border-edge-soft/70 bg-canvas px-3 text-[13px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
        />
        {detected && !name.trim() && (
          <span className="text-[10px] text-ink-subtle">{t("We'll name it from the URL.")}</span>
        )}
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        {!hideCancel && onCancel && (
          <button
            onClick={onCancel}
            className="h-9 rounded-lg px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
        )}
        <button
          disabled={!detected}
          onClick={submit}
          className="h-9 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
