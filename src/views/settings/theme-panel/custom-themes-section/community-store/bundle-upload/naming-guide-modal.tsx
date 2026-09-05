import { useEffect, useState } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { Check, FileType2, Film, FolderArchive, Sparkles, Tag, Wand2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { ROW_TITLE } from "../../../../shared";
import { iconGroupsFor, type BundleKind } from "./icon-keys";

type Step = { icon: typeof Tag; title: string; body: string };
type Translate = (key: string, vars?: Record<string, string | number>) => string;

function stepsFor(kind: BundleKind, t: Translate): Step[] {
  const example =
    kind === "badge" ? "4k.png, hdr.png, atmos.png" : "oscar.png, emmy.png, cannes.png";
  return [
    {
      icon: Tag,
      title: t("Name each file after its slot"),
      body: t(
        "That is the whole trick. A file called {example} drops straight into the matching slot. The name before .png is all that matters, capitals and spaces are ignored.",
        { example },
      ),
    },
    {
      icon: Wand2,
      title: t("Any size works, we optimize it"),
      body: t(
        "Drop in art at any resolution. Harbor resizes and compresses anything oversized for you, so nothing gets skipped for being too big. Square PNGs with a transparent background look best.",
      ),
    },
    {
      icon: Film,
      title: t("Animated GIFs are welcome"),
      body: t(
        "Want a badge that moves? Drop in a GIF up to 8 MB. Harbor shrinks it down and converts it to a lightweight animated format so it stays crisp and loads fast. Keep it small and looping.",
      ),
    },
    {
      icon: FolderArchive,
      title: t("Three ways to add art"),
      body: t(
        "Click any single slot to pick one file, select many PNGs at once, or drop a whole .zip of them. Named files land in their slots automatically, the rest you can place by hand.",
      ),
    },
    ...(kind === "award"
      ? [
          {
            icon: Sparkles,
            title: t("Invent your own award types"),
            body: t(
              "Awards are not a fixed list. Add a custom award type, name it anything, and give it its own art. It shows up alongside the built-in trophies.",
            ),
          },
        ]
      : []),
  ];
}

export function NamingGuideModal({
  kind,
  open,
  onClose,
}: {
  kind: BundleKind;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { closing, close } = useModalExit(onClose, open);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  useEffect(() => {
    if (!open) setCopied(null);
  }, [open]);

  if (!open) return null;

  const groups = iconGroupsFor(kind);
  const steps = stepsFor(kind, t);

  const copyName = (file: string) => {
    navigator.clipboard?.writeText(file).then(
      () => {
        setCopied(file);
        window.setTimeout(() => setCopied((c) => (c === file ? null : c)), 1200);
      },
      () => {},
    );
  };

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[250] flex items-center justify-center p-6`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[86vh] w-[min(680px,100%)] flex-col overflow-hidden rounded-md bg-surface shadow-2xl animate-popover-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-ink">
              {kind === "badge" ? t("How badge packs work") : t("How award packs work")}
            </h2>
            <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
              {t("Name your files, drop them in, done.")}
            </p>
          </div>
          <button
            onClick={close}
            aria-label={t("Close")}
            className="-me-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-2">
          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-canvas text-ink-muted">
                  <step.icon size={20} strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={ROW_TITLE}>
                    <span className="text-ink-subtle">{i + 1}.</span> {step.title}
                  </span>
                  <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-md bg-canvas p-4">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`flex items-center gap-2 ${ROW_TITLE}`}>
                <FileType2 size={17} strokeWidth={2.2} className="shrink-0 text-accent" />
                {t("Every slot name")}
              </span>
              <span className="text-[15.5px] leading-[22px] text-ink-subtle">
                {t("tap a name to copy")}
              </span>
            </span>
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.title} className="flex flex-col gap-2">
                  <span className="harbor-settings-label">{t(g.title)}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((it) => {
                      const file = `${it.key}.png`;
                      const isCopied = copied === file;
                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => copyName(file)}
                          title={it.label}
                          className={`flex h-11 items-center gap-2 rounded-md px-3 text-[15.5px] leading-[22px] transition-colors ${
                            isCopied
                              ? "bg-accent-soft text-accent"
                              : "bg-elevated text-ink-muted hover:text-ink"
                          }`}
                        >
                          {isCopied && <Check size={16} strokeWidth={2.8} />}
                          <span className="font-mono">{file}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {kind === "award" && (
                <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
                  {t(
                    "Not here? Add a custom award type on the previous screen and name its file anything you like.",
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-4">
          <button
            onClick={close}
            className="flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold leading-[22px] text-canvas transition-opacity hover:opacity-90"
          >
            {t("Got it")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
