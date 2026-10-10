import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, Clock, Eye, Pause, Repeat, Trash2 } from "lucide-react";
import type { RemoteLibraryAction, RemoteTrackers } from "@/lib/remote/protocol";
import { useT } from "@/lib/i18n";
import { Group, SheetRow } from "./sheet-ui";

type TrackerId = "simkl" | "anilist" | "mal";

type StatusOption = {
  label: string;
  icon: ReactNode;
  op: RemoteLibraryAction;
  key: string;
  remove?: boolean;
};

type TrackerRow = { id: TrackerId; name: string; options: StatusOption[] };

function statusIcon(label: string): ReactNode {
  switch (label) {
    case "Watching":
      return <Eye size={19} strokeWidth={2} />;
    case "Plan to Watch":
      return <Clock size={19} strokeWidth={2} />;
    case "Completed":
      return <Check size={19} strokeWidth={2.4} />;
    case "On Hold":
      return <Pause size={19} strokeWidth={2} />;
    case "Rewatching":
      return <Repeat size={19} strokeWidth={2} />;
    default:
      return <Ban size={19} strokeWidth={2} />;
  }
}

function status(label: string, op: RemoteLibraryAction, key: string): StatusOption {
  return { label, icon: statusIcon(label), op, key };
}

function remove(op: RemoteLibraryAction): StatusOption {
  return {
    label: "Remove",
    icon: <Trash2 size={19} strokeWidth={2} />,
    op,
    key: "remove",
    remove: true,
  };
}

function simklOptions(isSeriesLike: boolean): StatusOption[] {
  const base = isSeriesLike
    ? [
        status("Watching", { kind: "simkl", status: "watching" }, "watching"),
        status("Plan to Watch", { kind: "simkl", status: "plantowatch" }, "plantowatch"),
        status("Completed", { kind: "simkl", status: "completed" }, "completed"),
        status("On Hold", { kind: "simkl", status: "hold" }, "hold"),
        status("Dropped", { kind: "simkl", status: "dropped" }, "dropped"),
      ]
    : [
        status("Plan to Watch", { kind: "simkl", status: "plantowatch" }, "plantowatch"),
        status("Completed", { kind: "simkl", status: "completed" }, "completed"),
        status("Dropped", { kind: "simkl", status: "dropped" }, "dropped"),
      ];
  return [...base, remove({ kind: "simkl", status: null })];
}

function anilistOptions(): StatusOption[] {
  return [
    status("Watching", { kind: "anilist", status: "CURRENT" }, "CURRENT"),
    status("Plan to Watch", { kind: "anilist", status: "PLANNING" }, "PLANNING"),
    status("Completed", { kind: "anilist", status: "COMPLETED" }, "COMPLETED"),
    status("Rewatching", { kind: "anilist", status: "REPEATING" }, "REPEATING"),
    status("On Hold", { kind: "anilist", status: "PAUSED" }, "PAUSED"),
    status("Dropped", { kind: "anilist", status: "DROPPED" }, "DROPPED"),
    remove({ kind: "anilist", status: null }),
  ];
}

function malOptions(): StatusOption[] {
  return [
    status("Watching", { kind: "mal", status: "watching" }, "watching"),
    status("Plan to Watch", { kind: "mal", status: "plan_to_watch" }, "plan_to_watch"),
    status("Completed", { kind: "mal", status: "completed" }, "completed"),
    status("On Hold", { kind: "mal", status: "on_hold" }, "on_hold"),
    status("Dropped", { kind: "mal", status: "dropped" }, "dropped"),
    remove({ kind: "mal", status: null }),
  ];
}

function buildRows(
  trackers: RemoteTrackers,
  isAnime: boolean,
  isSeriesLike: boolean,
): TrackerRow[] {
  const rows: TrackerRow[] = [];
  if (trackers.simkl)
    rows.push({ id: "simkl", name: "Simkl", options: simklOptions(isSeriesLike || isAnime) });
  if (trackers.anilist && isAnime)
    rows.push({ id: "anilist", name: "AniList", options: anilistOptions() });
  if (trackers.mal && isAnime) rows.push({ id: "mal", name: "MyAnimeList", options: malOptions() });
  return rows;
}

export function TrackGroup({
  trackers,
  isAnime,
  isSeriesLike,
  reduced,
  send,
}: {
  trackers: RemoteTrackers;
  isAnime: boolean;
  isSeriesLike: boolean;
  reduced: boolean;
  send: (op: RemoteLibraryAction) => boolean;
}) {
  const t = useT();
  const rows = useMemo(
    () => buildRows(trackers, isAnime, isSeriesLike),
    [trackers, isAnime, isSeriesLike],
  );
  const [open, setOpen] = useState<TrackerId | null>(null);
  const [chosen, setChosen] = useState<Partial<Record<TrackerId, string>>>({});
  const [note, setNote] = useState<{ id: TrackerId; text: string; ok: boolean } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (rows.length === 0) return null;

  const pick = (row: TrackerRow, opt: StatusOption) => {
    const sent = send(opt.op);
    if (sent) {
      setChosen((c) => ({ ...c, [row.id]: opt.key }));
      setNote({
        id: row.id,
        text: opt.remove
          ? t("Removed from {service}", { service: row.name })
          : t("Saved to {service} as {status}", { service: row.name, status: t(opt.label) }),
        ok: true,
      });
    } else {
      setNote({ id: row.id, text: t("Not connected to your computer"), ok: false });
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), 2200);
  };

  return (
    <Group label={t("Track")}>
      <div className="flex flex-col gap-1">
        {rows.map((row) => {
          const isOpen = open === row.id;
          const pickedKey = chosen[row.id];
          const picked = row.options.find((o) => o.key === pickedKey);
          const sub = picked
            ? picked.remove
              ? t("Not tracked")
              : t(picked.label)
            : t("Set your status");
          return (
            <div key={row.id} className="overflow-hidden rounded-2xl bg-surface/40">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((v) => (v === row.id ? null : row.id))}
                className="flex w-full items-center gap-3.5 px-3 py-3 text-start transition-colors active:bg-elevated/50 motion-reduce:transition-none"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-[13px] font-bold uppercase text-ink">
                  {row.name.slice(0, 2)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-ink">{row.name}</span>
                  <span className="text-[12px] leading-tight text-ink-subtle">{sub}</span>
                </span>
                <ChevronDown
                  size={19}
                  strokeWidth={2.2}
                  className={`shrink-0 text-ink-subtle transition-transform duration-200 motion-reduce:transition-none ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {note?.id === row.id && (
                <p
                  className={`px-4 pb-1.5 text-[12px] font-medium ${
                    note.ok ? "text-accent" : "text-danger"
                  }`}
                >
                  {note.text}
                </p>
              )}
              {isOpen && (
                <div className={`flex flex-col px-1.5 pb-1.5 ${reduced ? "" : "md-accordion"}`}>
                  {row.options.map((opt) => (
                    <SheetRow
                      key={opt.key}
                      icon={opt.icon}
                      label={
                        opt.remove
                          ? t("Remove from {service}", { service: row.name })
                          : t(opt.label)
                      }
                      active={pickedKey === opt.key}
                      trailing={
                        pickedKey === opt.key ? (
                          <Check size={18} strokeWidth={2.6} className="text-accent" />
                        ) : undefined
                      }
                      onClick={() => pick(row, opt)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Group>
  );
}
