import { Check, Copy, ImagePlus, Plus, Trash2 } from "lucide-react";
import type { CustomTheme } from "@/lib/custom-themes";
import { useT } from "@/lib/i18n";
import { Field } from "../field";

export const STEPS = ["Version", "Cover", "Screenshots", "Changes"];

export function UpdateStepRail({ step }: { step: number }) {
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

export function PickThemeStep({
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
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-edge px-6 py-16 text-center">
        <span className="text-[15px] font-semibold text-ink">
          {t("No local themes to publish")}
        </span>
        <span className="max-w-[38ch] text-[13px] text-ink-muted">
          {t(
            "Build or import the updated theme first, then come back to push it as a new version.",
          )}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] text-ink-muted">
        {t("Pick the theme with your latest changes. It becomes the new version.")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => {
          const active = selected?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col overflow-hidden rounded-md border text-start transition ${
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
              <span className="truncate px-3.5 py-2.5 text-[13.5px] font-semibold text-ink">
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShotsStep({
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
      <p className="text-[13.5px] text-ink-muted">
        {t("Optional. Adding any screenshots replaces your current set.")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shots.map((s, i) => (
          <div key={i} className="group relative aspect-video overflow-hidden rounded-md">
            <img src={s.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              aria-label={t("Remove")}
              className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100 [[data-input-modality=keys]_&]:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {shots.length < 6 && (
          <button
            onClick={onAdd}
            className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-edge text-ink-subtle transition-colors hover:border-accent hover:text-ink"
          >
            {shots.length === 0 ? (
              <ImagePlus size={24} strokeWidth={1.6} />
            ) : (
              <Plus size={22} strokeWidth={1.8} />
            )}
            <span className="text-[12.5px] font-medium">{t("Add screenshot")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ChangelogStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex max-w-[460px] flex-col gap-5">
      <p className="text-[13.5px] text-ink-muted">
        {t("Tell people what changed in this version. Reviewers see it too.")}
      </p>
      <Field label={t("What changed")} hint={`${value.length}/280`}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder={t("Warmer accent, fixed the sidebar contrast, new cover")}
          className="resize-none rounded-md bg-canvas px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-subtle focus: focus:outline-none transition-colors focus:bg-elevated"
        />
      </Field>
    </div>
  );
}

export function UpdateSuccessView({
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
        <h2 className="font-display text-[26px] font-medium text-ink">{t("Update submitted")}</h2>
        <p className="max-w-[42ch] text-[13.5px] text-ink-muted">
          {t(
            "Your new version is in for a quick review. The live listing keeps working until this one is approved.",
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-elevated px-3 py-2">
        <span className="max-w-[280px] truncate text-[12.5px] text-ink-muted">{share}</span>
        <button
          onClick={onCopy}
          className="flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[12.5px] font-semibold text-canvas"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
          {copied ? t("Copied") : t("Copy link")}
        </button>
      </div>
      <button
        onClick={onDone}
        className="mt-2 h-11 rounded-md bg-accent px-8 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Done")}
      </button>
    </div>
  );
}
