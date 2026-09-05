import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, Loader2, UploadCloud, X } from "lucide-react";
import { getActiveModal, isBackKey, isEditable } from "@/lib/keyboard-navigation/geometry";
import { exportThemeJson, getCustomThemes, type CustomTheme } from "@/lib/custom-themes";
import { optimizeBackgroundForShare } from "../image-utils";
import { updateTheme, type StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { CheatSheet } from "../theme-studio/cheat-sheet";
import { CoverCropper } from "./theme-upload/cover-cropper";
import { ListingPreview } from "./theme-upload/listing-preview";
import { scaleToBlob } from "./theme-upload/upload-utils";
import {
  ChangelogStep,
  PickThemeStep,
  ShotsStep,
  STEPS,
  UpdateStepRail,
  UpdateSuccessView,
} from "./theme-update-flow/update-steps";

export function ThemeUpdateFlow({
  target,
  onClose,
  onUpdated,
}: {
  target: StoreTheme;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const t = useT();
  const localThemes = useMemo(() => getCustomThemes(), []);
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<CustomTheme | null>(
    () => localThemes.find((t) => t.name === target.name) ?? localThemes[0] ?? null,
  );
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([]);
  const [changelog, setChangelog] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ share: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const stepBack = () => {
    if (!result && step > 0) setStep((s) => s - 1);
    else onClose();
  };
  const stepBackRef = useRef(stepBack);
  stepBackRef.current = stepBack;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = rootRef.current;
      const from = e.target instanceof HTMLElement ? e.target : null;
      if (!isBackKey(e) || !root || isEditable(from)) return;
      if (getActiveModal(from) !== root) return;
      e.preventDefault();
      e.stopPropagation();
      stepBackRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!coverBlob) return setCoverUrl(null);
    const u = URL.createObjectURL(coverBlob);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [coverBlob]);

  const swatch = theme?.swatch ?? target.swatch;

  const addShots = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []).slice(0, 6 - shots.length);
      const added = await Promise.all(
        files.map(async (f) => {
          const blob = await scaleToBlob(f);
          return { blob, url: URL.createObjectURL(blob) };
        }),
      );
      setShots((s) => [...s, ...added].slice(0, 6));
    };
    input.click();
  };
  const removeShot = (i: number) =>
    setShots((s) => {
      URL.revokeObjectURL(s[i].url);
      return s.filter((_, j) => j !== i);
    });

  const canAdvance = step === 0 ? !!theme : step === 3 ? changelog.trim().length > 0 : true;

  const submit = async () => {
    if (!theme || !changelog.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const shared: CustomTheme = theme.background?.image
        ? {
            ...theme,
            background: {
              ...theme.background,
              image: await optimizeBackgroundForShare(theme.background.image),
            },
          }
        : theme;
      const json = exportThemeJson(shared);
      const updated = await updateTheme(
        target.id,
        json,
        coverBlob,
        shots.map((s) => s.blob),
        changelog.trim(),
      );
      setResult({ share: updated.share });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[300] flex flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={t("Update a theme")}
    >
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-start justify-between gap-4 px-10 pb-5 pt-6"
      >
        <div data-tauri-drag-region className="flex flex-col gap-1">
          <h1 className="pointer-events-none text-[17px] font-semibold tracking-tight text-ink">
            {t("Update {name}", { name: target.name })}
          </h1>
          <p className="pointer-events-none max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
            {t(
              "Push a new version. Your published version stays live while the update is reviewed.",
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      {result ? (
        <UpdateSuccessView
          share={result.share}
          copied={copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(result.share);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
          onDone={onUpdated}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto flex h-full max-w-[1100px] flex-col gap-6 px-10 py-8">
            <UpdateStepRail step={step} />
            <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-[1fr_300px]">
              <div
                key={step}
                className="harbor-step min-h-0 overflow-y-auto pe-1 [scrollbar-width:thin]"
              >
                {step === 0 && (
                  <PickThemeStep themes={localThemes} selected={theme} onSelect={setTheme} />
                )}
                {step === 1 && (
                  <div className="flex flex-col gap-3">
                    <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
                      {t("Optional. Skip this step to keep your current cover.")}
                    </p>
                    <CoverCropper onChange={setCoverBlob} />
                  </div>
                )}
                {step === 2 && <ShotsStep shots={shots} onAdd={addShots} onRemove={removeShot} />}
                {step === 3 && <ChangelogStep value={changelog} onChange={setChangelog} />}
              </div>
              <div className="hidden lg:block">
                <ListingPreview
                  name={theme?.name ?? target.name}
                  author={target.author}
                  blurb={theme?.blurb ?? target.blurb}
                  swatch={swatch}
                  coverUrl={coverUrl ?? target.cover}
                />
              </div>
            </div>
            {error && <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">{error}</p>}
          </div>
        </div>
      )}

      {!result && (
        <footer className="flex shrink-0 items-center justify-between gap-4 px-10 pb-6 pt-4">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-11 items-center gap-2 rounded-md bg-elevated px-4 text-[15.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <BookOpen size={18} strokeWidth={2.1} />
            {t("API cheat sheet")}
          </button>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
              className="flex h-11 items-center gap-2 rounded-md bg-elevated px-4 text-[15.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={18} className="dir-icon" /> {step === 0 ? t("Cancel") : t("Back")}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canAdvance && setStep((s) => s + 1)}
                disabled={!canAdvance}
                className="flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("Continue")} <ArrowRight size={18} className="dir-icon" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting || !theme || !changelog.trim()}
                className="flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UploadCloud size={18} />
                )}
                {submitting ? t("Submitting…") : t("Submit update")}
              </button>
            )}
          </div>
        </footer>
      )}
      {sheetOpen && <CheatSheet onClose={() => setSheetOpen(false)} />}
    </div>,
    document.body,
  );
}
