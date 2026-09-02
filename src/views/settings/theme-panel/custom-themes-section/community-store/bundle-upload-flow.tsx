import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Globe,
  KeyRound,
  Loader2,
  type LucideIcon,
  Package,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { currentAuthor, subscribeAuthor, type Author } from "@/lib/theme-auth";
import { recordBundleUpload, uploadBundle } from "@/lib/bundle-store";
import { AuthorAccountPanel } from "../author-account-panel";
import { CoverCropper } from "../theme-upload/cover-cropper";
import { IconAssignStep, type AssignedIcon } from "./bundle-upload/icon-assign-step";
import { BundleDetailsStep } from "./bundle-upload/bundle-details-step";
import { BundleListingPreview } from "./bundle-upload/bundle-listing-preview";
import type { BundleKind } from "./bundle-upload/icon-keys";

const STEPS = ["Icons", "Cover", "Details"];
const AUTHOR_KEY = "harbor.bundle-author";

export function BundleUploadFlow({
  initialKind = "badge",
  onClose,
}: {
  initialKind?: BundleKind;
  onClose: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<BundleKind>(initialKind);
  const [icons, setIcons] = useState<AssignedIcon[]>([]);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ share: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [account, setAccount] = useState<Author | null>(currentAuthor);
  useEffect(() => subscribeAuthor(() => setAccount(currentAuthor())), []);

  useEffect(() => {
    setAuthor(account?.username || localStorage.getItem(AUTHOR_KEY) || "");
  }, [account]);
  useEffect(() => {
    if (!coverBlob) return setCoverUrl(null);
    const u = URL.createObjectURL(coverBlob);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [coverBlob]);

  const changeKind = (k: BundleKind) => {
    if (k === kind) return;
    setKind(k);
    setIcons([]);
  };

  const assigned = icons.filter((i): i is AssignedIcon & { key: string } => !!i.key);
  const iconsReady = icons.length > 0 && icons.every((i) => !!i.key);
  const canAdvance = step === 0 ? iconsReady : step === 1 ? !!coverBlob : true;

  const submit = async () => {
    if (!coverBlob || !name.trim() || assigned.length === 0 || assigned.length !== icons.length)
      return;
    setSubmitting(true);
    setError(null);
    try {
      const manifest = JSON.stringify({
        name: name.trim(),
        kind,
        description: description.trim(),
        icons: assigned.map((i) => ({ key: i.key })),
      });
      const res = await uploadBundle(
        manifest,
        coverBlob,
        assigned.map((i) => ({ key: i.key, blob: i.file })),
        author.trim(),
      );
      recordBundleUpload({
        id: res.id,
        ownerToken: res.ownerToken,
        name: name.trim(),
        share: res.share,
      });
      if (author.trim()) localStorage.setItem(AUTHOR_KEY, author.trim());
      setResult({ share: res.share });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-canvas"
      role="dialog"
      aria-label={t("Share an icon pack")}
    >
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-start justify-between gap-4 px-10 pb-5 pt-6"
      >
        <div data-tauri-drag-region className="flex flex-col gap-1">
          <h1 className="pointer-events-none text-[17px] font-semibold tracking-tight text-ink">
            {t("Share an icon pack")}
          </h1>
          <p className="pointer-events-none text-[12.5px] text-ink-subtle">
            {t("It goes to a quick review, then it's live for everyone.")}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      {!account ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-8 py-10">
          <div className="grid w-full max-w-md items-center gap-x-14 gap-y-9 lg:max-w-[860px] lg:grid-cols-[1fr_minmax(0,376px)]">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Package size={24} strokeWidth={1.9} />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-balance text-[20px] font-semibold leading-tight tracking-tight text-ink">
                    {t("Your icons, in everyone's library")}
                  </h2>
                  <p className="text-balance text-[13.5px] leading-relaxed text-ink-muted">
                    {t("Create a free account to publish. No email required.")}
                  </p>
                </div>
              </div>
              <ul className="flex flex-col gap-4">
                <Benefit icon={ShieldCheck} title={t("Always yours")}>
                  {t("Update the pack or take it down whenever you want.")}
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
              setCopied(false);
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
                {step === 0 && (
                  <IconAssignStep
                    kind={kind}
                    onKind={changeKind}
                    icons={icons}
                    onChange={setIcons}
                  />
                )}
                {step === 1 && <CoverCropper onChange={setCoverBlob} />}
                {step === 2 && (
                  <BundleDetailsStep
                    name={name}
                    account={account}
                    description={description}
                    onName={setName}
                    onDescription={setDescription}
                  />
                )}
              </div>
              <div className="hidden lg:block">
                <BundleListingPreview
                  kind={kind}
                  name={name}
                  author={author}
                  description={description}
                  coverUrl={coverUrl}
                  previews={icons.map((i) => i.preview)}
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>
        </div>
      )}

      {account && !result && (
        <footer className="flex shrink-0 items-center justify-end gap-2.5 px-10 pb-6 pt-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="flex h-9 items-center gap-2 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} className="dir-icon" /> {step === 0 ? t("Cancel") : t("Back")}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canAdvance && setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="flex h-9 items-center gap-2 rounded-md bg-ink px-5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t("Continue")} <ArrowRight size={16} className="dir-icon" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !coverBlob || !name.trim() || !iconsReady}
              className="flex h-9 items-center gap-2 rounded-md bg-ink px-5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} strokeWidth={2.2} />
              )}
              {submitting ? t("Submitting…") : t("Submit for review")}
            </button>
          )}
        </footer>
      )}
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
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-bold transition-colors ${
                i < step
                  ? "bg-accent text-canvas"
                  : i === step
                    ? "bg-ink text-canvas"
                    : "bg-elevated text-ink-subtle"
              }`}
            >
              {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-[13px] font-semibold ${i <= step ? "text-ink" : "text-ink-subtle"}`}
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
      <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-ink-muted">
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] leading-relaxed text-ink-subtle">{children}</span>
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
        <p className="max-w-[42ch] text-[13.5px] text-ink-muted">
          {t(
            "Thanks for sharing. It'll appear in the library once it's approved. You can manage it any time from your uploads.",
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-surface p-2 ps-3">
        <span className="max-w-[280px] truncate text-[12.5px] text-ink-muted">{share}</span>
        <button
          onClick={onCopy}
          className="flex h-8 items-center gap-1.5 rounded-md bg-elevated px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? t("Copied") : t("Copy link")}
        </button>
      </div>
      <button
        onClick={onDone}
        className="mt-2 h-9 rounded-md bg-ink px-6 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Done")}
      </button>
    </div>
  );
}
