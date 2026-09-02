import { Check, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { UiIcon } from "@/components/ui-icon";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import { emitListToast } from "@/components/lists/list-toast";
import { useT } from "@/lib/i18n";
import {
  ensureNotifyPermission,
  playTone,
  removeReminder,
  setReminder,
  useReminder,
  type ReminderTone,
} from "@/lib/reminders";

const TONES: Array<{ id: ReminderTone; label: string }> = [
  { id: "chime", label: "Chime" },
  { id: "pulse", label: "Pulse" },
  { id: "silent", label: "Silent" },
];

type ReminderSeed = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
};

function ReminderMenu({
  seed,
  anchorRef,
  open,
  onClose,
}: {
  seed: ReminderSeed;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const existing = useReminder(seed.id);
  const active = !!existing;
  const [episodes, setEpisodes] = useState(true);
  const [seasons, setSeasons] = useState(true);
  const [tone, setTone] = useState<ReminderTone>("chime");

  useEffect(() => {
    if (!open) return;
    setEpisodes(existing?.episodes ?? true);
    setSeasons(existing?.seasons ?? true);
    setTone(existing?.tone ?? "chime");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    const now = Date.now();
    setReminder({
      id: seed.id,
      name: seed.name,
      poster: seed.poster,
      type: seed.type,
      episodes,
      seasons,
      tone,
      lastNotifiedAt: existing?.lastNotifiedAt ?? now,
      createdAt: existing?.createdAt ?? now,
      seenKeys: existing?.seenKeys,
    });
    onClose();
    emitListToast(active ? t("Reminder updated") : t("Reminder set"));
    void ensureNotifyPermission();
  };

  const remove = () => {
    removeReminder(seed.id);
    onClose();
    emitListToast(t("Reminder removed"));
  };

  const rows = [
    {
      key: "episodes",
      label: t("New episodes"),
      sub: t("When a new episode airs"),
      value: episodes,
      set: setEpisodes,
    },
    {
      key: "seasons",
      label: t("New seasons"),
      sub: t("When a new season premieres"),
      value: seasons,
      set: setSeasons,
    },
  ];

  return (
    <AnchoredMenu anchorRef={anchorRef} open={open} onClose={onClose} width={300}>
      <div className="animate-popover-in overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-edge-soft/55 px-3.5 pb-2 pt-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            {t("Remind me about")}
          </span>
          {active && (
            <button
              onClick={remove}
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-danger transition-colors hover:text-danger/80"
            >
              {t("Remove")}
            </button>
          )}
        </div>
        <div className="flex flex-col py-1.5">
          {rows.map((r) => (
            <button
              key={r.key}
              onClick={() => r.set(!r.value)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-raised"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  r.value ? "border-accent bg-accent/15 text-accent" : "border-edge"
                }`}
              >
                {r.value && <Check size={13} strokeWidth={2.6} />}
              </span>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-medium text-ink">{r.label}</span>
                <span className="text-[11.5px] text-ink-subtle">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="px-3.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Tone")}
        </div>
        <div className="grid grid-cols-3 gap-1.5 px-3.5">
          {TONES.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setTone(o.id);
                playTone(o.id);
              }}
              className={`h-9 rounded-lg text-[12.5px] font-medium transition-colors ${
                tone === o.id
                  ? "bg-raised text-ink ring-1 ring-edge"
                  : "bg-canvas/40 text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {t(o.label)}
            </button>
          ))}
        </div>
        <div className="p-3.5 pt-3">
          <button
            onClick={save}
            disabled={!episodes && !seasons}
            className="h-10 w-full rounded-xl bg-ink text-[13.5px] font-semibold text-canvas transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
          >
            {active ? t("Save changes") : t("Set reminder")}
          </button>
          <p className="pt-2.5 text-[11.5px] leading-snug text-ink-subtle">
            {t("Harbor checks a few times a day while it's open and lets you know here.")}
          </p>
        </div>
      </div>
    </AnchoredMenu>
  );
}

export function ReminderButton({ id, type, name, poster }: ReminderSeed) {
  const t = useT();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = !!useReminder(id);

  return (
    <>
      <HoverTooltip
        label={active ? t("Reminder on") : t("Remind me")}
        align="center"
        disabled={open}
        className="shrink-0"
      >
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={active ? t("Edit reminder") : t("Set reminder")}
          className={`group flex h-12 w-12 items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.94] ${
            active
              ? "bg-accent/20 text-accent hover:bg-accent/22"
              : "bg-canvas/80 text-ink hover:bg-canvas/95"
          }`}
        >
          <UiIcon name="remindme" className="h-5 w-5" />
        </button>
      </HoverTooltip>
      <ReminderMenu
        seed={{ id, type, name, poster }}
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function ReminderInlineLink({ id, type, name, poster }: ReminderSeed) {
  const t = useT();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = !!useReminder(id);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent transition-colors hover:text-accent/80"
      >
        {active ? t("Reminder set") : t("Set reminder")}
        <ChevronRight
          size={14}
          strokeWidth={2.4}
          className="dir-icon transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </button>
      <ReminderMenu
        seed={{ id, type, name, poster }}
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
