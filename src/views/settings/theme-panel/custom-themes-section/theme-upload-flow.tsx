import { exportThemeJson, getCustomThemes, type CustomTheme } from "@/lib/custom-themes";
import { recordUpload, uploadTheme } from "@/lib/theme-store";
import { ArrowLeft, ArrowRight, Check, Copy, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { CoverCropper } from "./theme-upload/cover-cropper";
import { ListingPreview } from "./theme-upload/listing-preview";
import { scaleToBlob } from "./theme-upload/upload-utils";

const STEPS = ["Theme", "Cover", "Screenshots", "Details"];

export function ThemeUploadFlow({ onClose }: { onClose: () => void }) {
  const myThemes = useMemo(() => getCustomThemes(), []);
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<CustomTheme | null>(myThemes[0] ?? null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([]);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [blurb, setBlurb] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ share: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (theme) {
      setName(theme.name);
      setBlurb(theme.blurb || "");
    }
  }, [theme]);
  useEffect(() => setAuthor(localStorage.getItem("harbor.theme-author") || ""), []);
  useEffect(() => {
    if (!coverBlob) return setCoverUrl(null);
    const u = URL.createObjectURL(coverBlob);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [coverBlob]);

  const swatch = theme?.swatch ?? ["#1a1d24", "#272b36", "#7b5cff"];

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

  const canAdvance = step === 0 ? !!theme : step === 1 ? !!coverBlob : step === 3 ? name.trim().length > 0 : true;

  const submit = async () => {
    if (!theme || !coverBlob) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...theme, name: name.trim() || theme.name, blurb: blurb.trim() };
      const json = exportThemeJson(payload);
      const res = await uploadTheme(
        json,
        coverBlob,
        shots.map((s) => s.blob),
        author.trim(),
      );
      recordUpload({ id: res.id, ownerToken: res.ownerToken, name: payload.name, share: res.share });
      if (author.trim()) localStorage.setItem("harbor.theme-author", author.trim());
      setResult({ share: res.share });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[220] flex flex-col bg-canvas" role="dialog" aria-label="Share a theme">
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between gap-4 border-b border-edge-soft bg-surface/40 px-10 py-5"
      >
        <div data-tauri-drag-region className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Sparkles size={18} strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <h1 className="pointer-events-none text-[20px] font-semibold tracking-tight text-ink">Share a theme</h1>
            <p className="pointer-events-none text-[12.5px] text-ink-subtle">
              It goes to a quick review, then it's live for everyone.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      {result ? (
        <SuccessView
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
          onDone={onClose}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto flex h-full max-w-[1100px] flex-col gap-6 px-10 py-8">
            <StepRail step={step} />
            <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-[1fr_300px]">
              <div key={step} className="harbor-step min-h-0 overflow-y-auto pe-1 [scrollbar-width:thin]">
                {step === 0 && <ThemeStep themes={myThemes} selected={theme} onSelect={setTheme} />}
                {step === 1 && <CoverCropper onChange={setCoverBlob} />}
                {step === 2 && <ShotsStep shots={shots} onAdd={addShots} onRemove={removeShot} />}
                {step === 3 && (
                  <DetailsStep
                    name={name}
                    author={author}
                    blurb={blurb}
                    onName={setName}
                    onAuthor={setAuthor}
                    onBlurb={setBlurb}
                  />
                )}
              </div>
              <div className="hidden lg:block">
                <ListingPreview name={name} author={author} blurb={blurb} swatch={swatch} coverUrl={coverUrl} />
              </div>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>
        </div>
      )}

      {!result && (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-edge-soft bg-surface/40 px-10 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <ArrowLeft size={15} className="dir-icon" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canAdvance && setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Continue <ArrowRight size={15} className="dir-icon" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !theme || !coverBlob || !name.trim()}
              className="flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </footer>
      )}
    </div>,
    document.body,
  );
}

function StepRail({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                i < step ? "bg-accent text-canvas" : i === step ? "bg-ink text-canvas" : "bg-elevated text-ink-subtle"
              }`}
            >
              {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-[13px] font-semibold ${i <= step ? "text-ink" : "text-ink-subtle"}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="h-px flex-1 bg-edge-soft">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: i < step ? "100%" : "0%" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ThemeStep({
  themes,
  selected,
  onSelect,
}: {
  themes: CustomTheme[];
  selected: CustomTheme | null;
  onSelect: (t: CustomTheme) => void;
}) {
  if (themes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge px-6 py-16 text-center">
        <span className="text-[15px] font-semibold text-ink">No themes to share yet</span>
        <span className="max-w-[38ch] text-[13px] text-ink-muted">
          Build one in the studio or import a theme file first, then come back to share it.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-ink-muted">Pick one of your themes to share.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => {
          const active = selected?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col overflow-hidden rounded-2xl border text-start transition-all ${
                active
                  ? "border-accent shadow-[0_0_0_2px_var(--color-accent-soft)]"
                  : "border-edge-soft bg-surface hover:border-edge"
              }`}
            >
              <div className="flex h-20 w-full">
                {t.swatch.map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <span className="truncate px-3.5 py-2.5 text-[13.5px] font-semibold text-ink">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShotsStep({
  shots,
  onAdd,
  onRemove,
}: {
  shots: { url: string }[];
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-ink-muted">
        Add up to 6 screenshots so people can see your theme in action. Optional, but they sell it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shots.map((s, i) => (
          <div key={i} className="group relative aspect-video overflow-hidden rounded-xl border border-edge-soft">
            <img src={s.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              aria-label="Remove"
              className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {shots.length < 6 && (
          <button
            onClick={onAdd}
            className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge text-ink-subtle transition-colors hover:border-accent hover:text-ink"
          >
            {shots.length === 0 ? <ImagePlus size={24} strokeWidth={1.6} /> : <Plus size={22} strokeWidth={1.8} />}
            <span className="text-[12.5px] font-medium">Add screenshot</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DetailsStep({
  name,
  author,
  blurb,
  onName,
  onAuthor,
  onBlurb,
}: {
  name: string;
  author: string;
  blurb: string;
  onName: (v: string) => void;
  onAuthor: (v: string) => void;
  onBlurb: (v: string) => void;
}) {
  return (
    <div className="flex max-w-[460px] flex-col gap-5">
      <Field label="Theme name">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={60}
          className="h-11 rounded-xl border border-edge-soft bg-elevated/40 px-3.5 text-[14px] text-ink focus:border-edge focus:outline-none"
        />
      </Field>
      <Field label="Your name" hint="Shown as the author. Remembered for next time.">
        <input
          value={author}
          onChange={(e) => onAuthor(e.target.value)}
          maxLength={60}
          placeholder="Anonymous"
          className="h-11 rounded-xl border border-edge-soft bg-elevated/40 px-3.5 text-[14px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
        />
      </Field>
      <Field label="Tagline" hint="One line shown under the name.">
        <textarea
          value={blurb}
          onChange={(e) => onBlurb(e.target.value)}
          maxLength={160}
          rows={2}
          className="resize-none rounded-xl border border-edge-soft bg-elevated/40 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
          placeholder="A short, punchy description"
        />
      </Field>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

function SuccessView({
  share,
  copied,
  onCopy,
  onDone,
}: {
  share: string;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
      <span className="harbor-step flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check size={32} strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[26px] font-medium text-ink">Submitted for review</h2>
        <p className="max-w-[42ch] text-[14px] text-ink-muted">
          Thanks for sharing. It'll appear in the library once it's approved. You can manage it any time from your
          uploads.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 px-3 py-2">
        <span className="max-w-[280px] truncate text-[12.5px] text-ink-muted">{share}</span>
        <button
          onClick={onCopy}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-semibold text-canvas"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <button
        onClick={onDone}
        className="mt-2 h-11 rounded-xl bg-accent px-8 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
}
