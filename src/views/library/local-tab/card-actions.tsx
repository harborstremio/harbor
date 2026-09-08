import { useEffect, useRef } from "react";
import { Ellipsis, FolderOpen, Info, Play, Trash2, Wand2, Download } from "lucide-react";
import {
  readLocalLibrary,
  removeLocalEntriesAcknowledged,
  subscribeLocalLibrary,
  type LocalEntry,
} from "@/lib/local-library";
import { existingLocalEntry, revealLocalEntry } from "@/lib/local-library/file-actions";
import { executeContextAction, type ContextAction } from "@/lib/context-actions";
import { useContextMenu, useContextTarget, type ContextMenuTarget } from "@/lib/context-menu";
import { alertDialog, confirmDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";

export function useLocalFileContext(
  entries: LocalEntry[],
  label: string,
  options: {
    onPlay: (entry: LocalEntry) => void | Promise<void>;
    onChoose?: (entries: LocalEntry[]) => void;
    chooseLabel?: string;
    onOpenDetail?: (entry: LocalEntry) => void;
    onFixMatch?: (entries: LocalEntry[]) => void;
    onExport?: (entries: LocalEntry[]) => void;
  },
) {
  const t = useT();
  const latest = useRef({ entries, label, options, t });
  latest.current = { entries, label, options, t };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const identity = JSON.stringify(entries.map((entry) => [entry.id, entry.path]));
  const valid = () =>
    alive.current &&
    JSON.stringify(latest.current.entries.map((entry) => [entry.id, entry.path])) === identity;
  const id = `local:${entries.map((entry) => entry.id).join(":")}`;
  const current = () =>
    latest.current.entries.flatMap((target) => {
      const entry = readLocalLibrary().find(
        (item) => item.id === target.id && item.path === target.path,
      );
      return entry ? [entry] : [];
    });
  const source = {
    kind: "actions" as const,
    id,
    label,
    subscribe: subscribeLocalLibrary,
    isValid: () => valid() && current().length > 0,
    actions: (): ContextAction[] => {
      if (!valid()) return [];
      const fresh = current();
      const { options, t } = latest.current;
      const first = fresh[0];
      if (!first) return [];
      const actions: ContextAction[] = [
        {
          id: `${id}:open`,
          label: options.onChoose
            ? (options.chooseLabel ?? t("Choose version"))
            : t("Play this file"),
          icon: <Play size={14} />,
          restoreFocus: false,
          run: async () => {
            if (options.onChoose) options.onChoose(fresh);
            else await options.onPlay(await existingLocalEntry(first));
          },
        },
      ];
      if (fresh.length === 1)
        actions.push({
          id: `${id}:reveal`,
          label: t("Show in folder"),
          icon: <FolderOpen size={14} />,
          run: () => revealLocalEntry(first),
        });
      if (options.onOpenDetail && (first.imdbId || first.tmdbId != null))
        actions.push({
          id: `${id}:details`,
          label: t("View details"),
          icon: <Info size={14} />,
          restoreFocus: false,
          run: () => options.onOpenDetail?.(first),
        });
      if (options.onFixMatch)
        actions.push({
          id: `${id}:match`,
          label: t("Fix match"),
          icon: <Wand2 size={14} />,
          restoreFocus: false,
          run: () => options.onFixMatch?.(fresh),
        });
      if (options.onExport && first.tmdbId != null)
        actions.push({
          id: `${id}:export`,
          label: t("Export .nfo and artwork"),
          icon: <Download size={14} />,
          run: () => options.onExport?.(fresh),
        });
      actions.push({
        id: `${id}:remove`,
        label:
          fresh.length === 1
            ? t("Remove from library; keep file")
            : t("Remove {count} entries from library; keep files", { count: fresh.length }),
        icon: <Trash2 size={14} />,
        danger: true,
        group: "remove",
        run: async () => {
          if (
            await confirmDialog(
              t(
                "Remove {count} entries from the local library? Files on disk are kept.\n\n{title}",
                { count: fresh.length, title: latest.current.label },
              ),
            )
          )
            await removeLocalEntriesAcknowledged(fresh);
        },
      });
      return actions;
    },
  };
  const ref = useContextTarget(() => source);
  const run = (action: string) => {
    void executeContextAction(source, `${id}:${action}`).catch((error) =>
      alertDialog(error instanceof Error ? error.message : String(error)),
    );
  };
  return { source, ref, run };
}

export function LocalMoreActions({ target }: { target: ContextMenuTarget }) {
  const { openAt, state } = useContextMenu();
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t("More actions")}
      aria-haspopup="menu"
      aria-expanded={
        state?.target.kind === "actions" &&
        target.kind === "actions" &&
        state.target.id === target.id
      }
      onClick={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        openAt({ x: rect.right, y: rect.bottom }, target);
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted opacity-0 hover:bg-raised hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Ellipsis size={15} />
    </button>
  );
}

export function LocalFileContextRow({
  entry,
  onPlay,
  children,
}: {
  entry: LocalEntry;
  onPlay: (entry: LocalEntry) => void | Promise<void>;
  children: (play: () => void) => React.ReactNode;
}) {
  const context = useLocalFileContext([entry], entry.filename, { onPlay });
  return (
    <div
      ref={context.ref}
      className="group flex items-center gap-1 [&>button:first-child]:min-w-0 [&>button:first-child]:flex-1"
    >
      {children(() => context.run("open"))}
      <LocalMoreActions target={context.source} />
    </div>
  );
}

export function SourceContextRow({
  id,
  label,
  actions,
  children,
}: {
  id: string;
  label: string;
  actions: () => ContextAction[];
  children: (play: () => void) => React.ReactNode;
}) {
  const latest = useRef({ id, actions });
  latest.current = { id, actions };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const source = {
    kind: "actions" as const,
    id,
    label,
    isValid: () => alive.current && latest.current.id === id,
    actions: () => (alive.current && latest.current.id === id ? latest.current.actions() : []),
  };
  const ref = useContextTarget(() => source);
  const play = () => {
    void executeContextAction(source, `${id}:play`).catch((error) =>
      alertDialog(error instanceof Error ? error.message : String(error)),
    );
  };
  return (
    <div
      ref={ref}
      className="group flex items-center gap-1 [&>button:first-child]:min-w-0 [&>button:first-child]:flex-1"
    >
      {children(play)}
      <LocalMoreActions target={source} />
    </div>
  );
}

/**
 * Shared, stable-identity props for every local card. Selection is passed as a
 * per-card boolean rather than the Set, so replacing the Set on each toggle
 * doesn't defeat React.memo across the whole grid.
 */
export type LocalCardProps = {
  selectMode: boolean;
  onToggleSelect: (ids: string[], range?: boolean) => void;
  onFixMatch: (entries: LocalEntry | LocalEntry[]) => void;
  onExport: (entries: LocalEntry | LocalEntry[]) => void;
  onOpenDetail: (entry: LocalEntry) => void;
};

export function CardIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={title}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas/70 text-ink opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-opacity duration-200 hover:bg-canvas/90 group-hover:opacity-100 focus-visible:opacity-100"
    >
      {children}
    </button>
  );
}
