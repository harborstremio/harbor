import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Globe,
  ImagePlus,
  KeyRound,
  Loader2,
  type LucideIcon,
  Palette,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { getActiveModal, isBackKey, isEditable } from "@/lib/keyboard-navigation/geometry";
import { exportThemeJson, getCustomThemes, type CustomTheme } from "@/lib/custom-themes";
import { currentAuthor, subscribeAuthor, type Author } from "@/lib/theme-auth";
import { recordUpload, uploadTheme } from "@/lib/theme-store";
import { optimizeBackgroundForShare } from "../image-utils";
import { CheatSheet } from "../theme-studio/cheat-sheet";
import { AuthorAccountPanel } from "./author-account-panel";
import { AuthorIdentity } from "./author-identity";
import { Field, inputClass } from "./field";
import { ROW_TITLE } from "../../shared";
import { CoverCropper } from "./theme-upload/cover-cropper";
import { ListingPreview } from "./theme-upload/listing-preview";
import { scaleToBlob } from "./theme-upload/upload-utils";

const STEPS = ["Theme", "Cover", "Screenshots", "Details"];

export function ThemeUploadFlow({ onClose }: { onClose: () => void }) {
  const t = useT();
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [account, setAccount] = useState<Author | null>(currentAuthor);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => subscribeAuthor(() => setAccount(currentAuthor())), []);

  const stepBack = () => {
    if (account && !result && step > 0) setStep((s) => s - 1);
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
    if (theme) {
      setName(theme.name);
      setBlurb(theme.blurb || "");
    }
  }, [theme]);
  useEffect(() => {
    setAuthor(account?.username || localStorage.getItem("harbor.theme-author") || "");
  }, [account]);
  useEffect(() => {
    if (!coverBlob) return setCoverUrl(null);
    const u = URL.createObjectURL(coverBlob);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [coverBlob]);

  const swatch = theme?.swatch ?? [
    "var(--color-canvas)",
    "var(--color-elevated)",
    "var(--color-accent)",
  ];

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

  const canAdvance =
    step === 0 ? !!theme : step === 1 ? !!coverBlob : step === 3 ? name.trim().length > 0 : true;

  const submit = async () => {
    if (!theme || !coverBlob) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...theme, name: name.trim() || theme.name, blurb: blurb.trim() };
      if (payload.background?.image) {
        const slim = await optimizeBackgroundForShare(payload.background.image);
        payload.background = { ...payload.background, image: slim };
      }
      const json = exportThemeJson(payload);
      const res = await uploadTheme(
        json,
        coverBlob,
        shots.map((s) => s.blob),
        author.trim(),
      );
      recordUpload({
        id: res.id,
        ownerToken: res.ownerToken,
        name: payload.name,
        share: res.share,
      });
      if (author.trim()) localStorage.setItem("harbor.theme-author", author.trim());
      setResult({ share: res.share });
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
      aria-label={t("Share a theme")}
    >
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-start justify-between gap-4 px-10 pb-5 pt-6"
      >
        <div data-tauri-drag-region className="flex flex-col gap-1">
          <h1 className="pointer-events-none text-[17px] font-semibold tracking-tight text-ink">
            {t("Share a theme")}
          </h1>
          <p className="pointer-events-none max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
            {t("It goes to a quick review, then it's live for everyone.")}
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

      {!account ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-8 py-10">
          <div className="grid w-full max-w-md items-center gap-x-14 gap-y-9 lg:max-w-[860px] lg:grid-cols-[1fr_minmax(0,376px)]">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Palette size={24} strokeWidth={1.9} />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-balance text-[20px] font-semibold leading-tight tracking-tight text-ink">
                    {t("Your theme, in everyone's library")}
                  </h2>
                  <p className="max-w-[66ch] text-balance text-[15.5px] leading-[22px] text-ink-muted">
                    {t("Create a free account to publish. No email required.")}
                  </p>
                </div>
              </div>
              <ul className="flex flex-col gap-4">
                <Benefit icon={ShieldCheck} title={t("Always yours")}>
                  {t("Update the look or take it down whenever you want.")}
                </Benefit>
                <Benefit icon={Globe} title={t("Live for everyone")}>
                  {t("Appears in the community library once approved.")}
                </Benefit>
                <Benefit icon={KeyRound} title={t("Simple recovery")}>
                  {t("You get a one-time code to restore access later.")}
                </Benefit>
              </ul>
            </div>
            <AuthorAccountPanel />
          </div>
        </div>
      ) : result ? (
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
              <div
                key={step}
                className="harbor-step min-h-0 overflow-y-auto pe-1 [scrollbar-width:thin]"
              >
                {step === 0 && <ThemeStep themes={myThemes} selected={theme} onSelect={setTheme} />}
                {step === 1 && <CoverCropper onChange={setCoverBlob} />}
                {step === 2 && <ShotsStep shots={shots} onAdd={addShots} onRemove={removeShot} />}
                {step === 3 && (
                  <DetailsStep
                    name={name}
                    account={account}
                    blurb={blurb}
                    onName={setName}
                    onBlurb={setBlurb}
                  />
                )}
              </div>
              <div className="hidden lg:block">
                <ListingPreview
                  name={name}
                  author={author}
                  blurb={blurb}
                  swatch={swatch}
                  coverUrl={coverUrl}
                />
              </div>
            </div>
            {error && <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">{error}</p>}
          </div>
        </div>
      )}

      {account && !result && (
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
                disabled={submitting || !theme || !coverBlob || !name.trim()}
                className="flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Upload size={18} strokeWidth={2.2} />
                )}
                {submitting ? t("Submitting…") : t("Submit for review")}
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

function StepRail({ step }: { step: number }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold tabular-nums transition-colors ${
                i < step
                  ? "bg-accent text-canvas"
                  : i === step
                    ? "bg-ink text-canvas"
                    : "bg-elevated text-ink-subtle"
              }`}
            >
              {i < step ? <Check size={16} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-[15.5px] font-semibold ${i <= step ? "text-ink" : "text-ink-subtle"}`}
            >
              {t(label)}
            </span>
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
  const t = useT();
  if (themes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md bg-surface px-6 py-16 text-center">
        <span className={ROW_TITLE}>{t("No themes to share yet")}</span>
        <span className="max-w-[60ch] text-[15.5px] leading-[22px] text-ink-muted">
          {t("Build one in the studio or import a theme file first, then come back to share it.")}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
        {t("Pick one of your themes to share.")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => {
          const active = selected?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col overflow-hidden rounded-md bg-surface text-start transition ${
                active ? "shadow-[0_0_0_2px_var(--color-accent)]" : "hover:bg-elevated"
              }`}
            >
              <div className="flex h-20 w-full">
                {t.swatch.map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <span className={`truncate px-3.5 py-2.5 ${ROW_TITLE}`}>
                {t.name}
              </span>
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
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
        {t(
          "Add up to 6 screenshots so people can see your theme in action. Optional, but they sell it.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shots.map((s, i) => (
          <div
            key={i}
            className="group relative aspect-video overflow-hidden rounded-md bg-surface"
          >
            <img src={s.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              aria-label={t("Remove")}
              className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-md bg-canvas text-ink opacity-0 transition-opacity hover:bg-canvas group-hover:opacity-100 [[data-input-modality=keys]_&]:opacity-100"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {shots.length < 6 && (
          <button
            onClick={onAdd}
            className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-edge bg-surface text-ink-subtle transition-colors hover:border-accent hover:text-ink"
          >
            {shots.length === 0 ? (
              <ImagePlus size={24} strokeWidth={1.6} />
            ) : (
              <Plus size={22} strokeWidth={1.8} />
            )}
            <span className="text-[15.5px] font-medium">{t("Add screenshot")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DetailsStep({
  name,
  account,
  blurb,
  onName,
  onBlurb,
}: {
  name: string;
  account: Author;
  blurb: string;
  onName: (v: string) => void;
  onBlurb: (v: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex max-w-[460px] flex-col gap-5">
      <Field label={t("Theme name")}>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={60}
          className={inputClass}
        />
      </Field>
      <AuthorIdentity account={account} />
      <Field label={t("Tagline")} hint={t("One line shown under the name.")}>
        <textarea
          value={blurb}
          onChange={(e) => onBlurb(e.target.value)}
          maxLength={160}
          rows={2}
          className="resize-none rounded-md bg-canvas px-3.5 py-2.5 text-[15.5px] leading-[22px] text-ink placeholder:text-ink-subtle transition-colors focus:bg-elevated focus:outline-none"
          placeholder={t("A short, punchy description")}
        />
      </Field>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-ink-muted">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className={ROW_TITLE}>{title}</span>
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">{children}</span>
      </div>
    </li>
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
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
      <span className="harbor-step flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check size={32} strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">
          {t("Submitted for review")}
        </h2>
        <p className="max-w-[60ch] text-[15.5px] leading-[22px] text-ink-muted">
          {t(
            "Thanks for sharing. It'll appear in the library once it's approved. You can manage it any time from your uploads.",
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-surface p-2 ps-3">
        <span className="max-w-[280px] truncate text-[15.5px] leading-[22px] text-ink-muted">{share}</span>
        <button
          onClick={onCopy}
          className="flex h-11 items-center gap-1.5 rounded-md bg-elevated px-3.5 text-[15.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
          {copied ? t("Copied") : t("Copy link")}
        </button>
      </div>
      <button
        onClick={onDone}
        className="mt-2 h-11 rounded-md bg-ink px-6 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Done")}
      </button>
    </div>
  );
}
