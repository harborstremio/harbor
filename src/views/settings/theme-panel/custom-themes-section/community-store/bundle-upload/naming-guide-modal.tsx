import { useEffect, useState } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { Check, FileType2, Film, FolderArchive, Sparkles, Tag, Wand2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
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
      if (e.key === "Escape") close();
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
        className="flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface shadow-2xl animate-popover-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              {kind === "badge" ? t("How badge packs work") : t("How award packs work")}
            </h2>
            <p className="text-[12.5px] text-ink-subtle">
              {t("Name your files, drop them in, done.")}
            </p>
          </div>
          <button
            onClick={close}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-2">
          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-muted">
                  <step.icon size={16} strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13.5px] font-medium text-ink">
                    <span className="text-ink-subtle">{i + 1}.</span> {step.title}
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 rounded-md bg-canvas p-4">
            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <FileType2 size={14} strokeWidth={2.2} className="text-accent" />{" "}
              {t("Every slot name")}
              <span className="text-[11.5px] font-normal text-ink-subtle">
                {t("tap a name to copy")}
              </span>
            </span>
            <div className="flex flex-col gap-3.5">
              {groups.map((g) => (
                <div key={g.title} className="flex flex-col gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
                    {t(g.title)}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((it) => {
                      const file = `${it.key}.png`;
                      const isCopied = copied === file;
                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => copyName(file)}
                          title={it.label}
                          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors ${
                            isCopied
                              ? "bg-accent-soft text-accent"
                              : "bg-elevated text-ink-muted hover:text-ink"
                          }`}
                        >
                          {isCopied && <Check size={12} strokeWidth={2.8} />}
                          <span className="font-mono">{file}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {kind === "award" && (
                <p className="text-[12.5px] leading-relaxed text-ink-subtle">
                  {t(
                    "Not here? Add a custom award type on the previous screen and name its file anything you like.",
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-3">
          <button
            onClick={close}
            className="flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Got it")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
