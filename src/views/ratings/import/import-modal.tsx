import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FileCheck, Upload, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import type { ImportSourceId, ImportSourceInput, RatingsSource } from "@/lib/ratings/import/types";
import { ImportProgressPanel, ImportSummaryPanel } from "./import-progress";
import {
  SourceList,
  fileAcceptOf,
  fileHintOf,
  keyFieldsOf,
  keyHintOf,
  type KeyField,
} from "./source-list";
import { useRatingsImport } from "./use-ratings-import";

type Keys = { apiKey: string; username: string };

const NO_KEYS: Keys = { apiKey: "", username: "" };

export function ImportModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const run = useRatingsImport();
  const [picked, setPicked] = useState<RatingsSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [keys, setKeys] = useState<Keys>(NO_KEYS);
  const [signedIn, setSignedIn] = useState(() => !!currentAuthor());

  const busy = run.status === "running";
  const { start, reset, cancel } = run;

  useEffect(() => subscribeAuthor(() => setSignedIn(!!currentAuthor())), []);

  const dismiss = useCallback(() => {
    if (busy) {
      cancel();
      return;
    }
    onClose();
  }, [busy, cancel, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [dismiss]);

  const pick = useCallback(
    (source: RatingsSource) => {
      setPicked(source);
      setFile(null);
      setKeys(NO_KEYS);
      if (source.kind === "session") start(source, {});
    },
    [start],
  );

  const begin = useCallback(() => {
    if (!picked) return;
    const input: ImportSourceInput =
      picked.kind === "file"
        ? { file: file ?? undefined }
        : { apiKey: keys.apiKey.trim() || undefined, username: keys.username.trim() || undefined };
    start(picked, input);
  }, [file, keys, picked, start]);

  const again = useCallback(() => {
    reset();
    setPicked(null);
    setFile(null);
    setKeys(NO_KEYS);
  }, [reset]);

  let body: ReactNode;
  if (!signedIn) {
    body = (
      <p className="text-[13.5px] leading-relaxed text-ink-muted">
        {t("Sign in to your Harbor account first. Imported ratings are saved to your profile.")}
      </p>
    );
  } else if (busy) {
    body = (
      <ImportProgressPanel
        label={picked?.label ?? ""}
        progress={run.progress}
        cancelling={run.cancelling}
        onCancel={cancel}
      />
    );
  } else if (run.status === "done" || run.status === "cancelled") {
    body = (
      <ImportSummaryPanel
        outcome={run.outcome}
        saved={run.progress.written}
        cancelled={run.status === "cancelled"}
        onDone={onClose}
        onAgain={again}
      />
    );
  } else if (run.status === "error") {
    body = (
      <div className="flex flex-col gap-4">
        <p className="rounded-[12px] bg-danger/15 px-3.5 py-3 text-[12.5px] leading-relaxed text-danger">
          {run.error ?? t("That import did not go through. Try again.")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={begin}
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Try again")}
          </button>
          <button
            type="button"
            onClick={again}
            className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface"
          >
            {t("Pick another source")}
          </button>
        </div>
      </div>
    );
  } else if (!picked) {
    body = <SourceList onPick={pick} />;
  } else {
    body = (
      <InputStep
        source={picked}
        file={file}
        keys={keys}
        onFile={setFile}
        onKeys={setKeys}
        onBack={again}
        onStart={begin}
      />
    );
  }

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-start justify-center bg-canvas/80 p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t("Import ratings")}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[80vh] w-[min(94vw,520px)] flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-medium text-ink">
              {picked ? t("Import from {name}", { name: picked.label }) : t("Import ratings")}
            </h2>
            {signedIn && !picked && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                {t("If you already rated a title, the imported score replaces it.")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={busy ? t("Cancel import") : t("Close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">{body}</div>
      </div>
    </div>,
    document.body,
  );
}

function InputStep({
  source,
  file,
  keys,
  onFile,
  onKeys,
  onBack,
  onStart,
}: {
  source: RatingsSource;
  file: File | null;
  keys: Keys;
  onFile: (f: File | null) => void;
  onKeys: (k: Keys) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const t = useT();
  const fields = keyFieldsOf(source.id);
  const hint = source.kind === "file" ? fileHintOf(source.id) : keyHintOf(source.id);
  const ready =
    source.kind === "file" ? !!file : fields.some((f) => keys[f.name].trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      {source.kind === "file" ? (
        <FilePick id={source.id} file={file} onFile={onFile} />
      ) : (
        fields.map((field) => (
          <KeyInput
            key={field.name}
            field={field}
            value={keys[field.name]}
            onChange={(v) => onKeys({ ...keys, [field.name]: v })}
          />
        ))
      )}

      {hint && <p className="text-[12px] leading-relaxed text-ink-subtle">{t(hint)}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("Start import")}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface"
        >
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

function FilePick({
  id,
  file,
  onFile,
}: {
  id: ImportSourceId;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer?.files?.[0];
          if (dropped) onFile(dropped);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          over
            ? "border-ink bg-elevated/70 text-ink"
            : "border-edge-soft/70 bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        {file ? (
          <FileCheck size={22} strokeWidth={1.7} className="text-success" />
        ) : (
          <Upload size={22} strokeWidth={1.7} />
        )}
        <span className="max-w-full truncate text-[13.5px] font-medium">
          {file ? file.name : t("Drop your export here, or click to browse")}
        </span>
        {file && (
          <span className="text-[11.5px] text-ink-subtle">{t("Click to choose a different file")}</span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={fileAcceptOf(id)}
        hidden
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) onFile(chosen);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function KeyInput({
  field,
  value,
  onChange,
}: {
  field: KeyField;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{t(field.label)}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(field.placeholder)}
        spellCheck={false}
        autoComplete="off"
        className="min-h-11 w-full rounded-md bg-surface px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge"
      />
    </label>
  );
}
