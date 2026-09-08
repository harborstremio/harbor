import { useRef, useState, type ReactNode } from "react";
import { FolderOpen, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { executeContextAction, type ContextAction } from "@/lib/context-actions";
import { alertDialog, confirmDialog } from "@/lib/dialog";
import {
  completedDownloadById,
  downloadById,
  downloadCapabilities,
  revealDownload,
  runDownloadBatch,
  subscribeDownloads,
  type DownloadBatchAction,
} from "@/lib/download/downloads-store";
import { downloadPlayerSrc } from "@/lib/download/player-src";
import { useT } from "@/lib/i18n";
import { readResumeMs } from "@/lib/resume";
import { useView } from "@/lib/view";

export function useDownloadItemActions(id: string, label: string) {
  const { actions } = useDownloadActions();
  const latest = useRef(actions);
  latest.current = actions;
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const source = {
    kind: "actions" as const,
    id: `download:${id}`,
    label,
    actions: () => latest.current(id),
    isValid: () => !!downloadById(id),
    subscribe: subscribeDownloads,
  };
  const run = (action: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    void executeContextAction(source, `download:${id}:${action}`)
      .catch((error: unknown) =>
        alertDialog(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  };
  return { source, run, pending };
}

export function useDownloadActions() {
  const t = useT();
  const view = useView();
  const latest = useRef({ t, view });
  latest.current = { t, view };

  const protectedPaths = () => {
    const url = latest.current.view.player?.url;
    return url && !/^(https?:|blob:|data:)/i.test(url) ? [url] : [];
  };

  const runBatch = async (ids: string[], action: DownloadBatchAction, scope: string) => {
    // Freeze the exact eligible IDs shown by this invocation before confirmation.
    const selected = [...new Set(ids)].filter((id) => downloadCapabilities(id)?.[action]);
    if (!selected.length)
      throw new Error(t("No downloads are currently eligible for this action."));
    if (action === "delete") {
      const files = selected
        .map((id) => downloadById(id))
        .filter((item) => item && !(item.kind === "ebook" && item.format === "pdf"));
      const details = selected.length === 1 ? (files[0]?.path ?? "") : scope;
      const approved = await confirmDialog(
        files.length === 0
          ? t(
              "Remove {count} PDF print records from Downloads? Harbor did not save these PDF files.",
              { count: selected.length },
            )
          : t(
              "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}",
              { count: selected.length, details },
            ),
      );
      if (!approved) return;
    }
    if (
      action === "cancel" &&
      selected.length > 1 &&
      !(await confirmDialog(
        t("Cancel {count} downloads? Partial files are kept.\n\n{scope}", {
          count: selected.length,
          scope,
        }),
      ))
    )
      return;
    const result = await runDownloadBatch(selected, action, { protectedPaths });
    if (result.failed.length || result.skipped.length) {
      const detail = result.failed
        .map(({ id, error }) => `${downloadById(id)?.title ?? id}: ${error}`)
        .join("\n");
      throw new Error(
        t("{done} completed, {failed} failed, {skipped} changed or unavailable.", {
          done: result.succeeded.length,
          failed: result.failed.length,
          skipped: result.skipped.length,
        }) + (detail ? `\n${detail}` : ""),
      );
    }
  };

  const play = async (id: string, resume: boolean) => {
    const item = await completedDownloadById(id);
    if (item.kind === "ebook") throw new Error(t("This download is a book, not a video."));
    const episode =
      item.season != null && item.episode != null
        ? { season: item.season, episode: item.episode }
        : undefined;
    latest.current.view.openPlayer({
      ...downloadPlayerSrc(
        {
          id: item.metaId,
          name: item.title,
          type: item.season != null ? "series" : "movie",
          poster: item.poster ?? undefined,
        },
        episode,
        item,
      ),
      resume,
      startFromZero: !resume,
    });
  };

  const actions = (id: string): ContextAction[] => {
    const item = downloadById(id);
    const caps = downloadCapabilities(id);
    if (!item || !caps) return [];
    const rows: ContextAction[] = [];
    if (caps.play) {
      const hasResume =
        readResumeMs(item.metaId, item.season ?? undefined, item.episode ?? undefined) > 0;
      if (hasResume)
        rows.push({
          id: `download:${id}:resume-playback`,
          label: t("Resume playback"),
          icon: <Play size={14} />,
          run: () => play(id, true),
          group: "play",
        });
      rows.push({
        id: `download:${id}:play`,
        label: hasResume ? t("Play from beginning") : t("Play"),
        icon: <Play size={14} />,
        run: () => play(id, false),
        group: "play",
      });
    }
    if (caps.reveal)
      rows.push({
        id: `download:${id}:reveal`,
        label: t("Show in folder"),
        icon: <FolderOpen size={14} />,
        run: () => revealDownload(id),
        group: "file",
      });
    const controls: { action: DownloadBatchAction; label: string; icon: ReactNode }[] = [
      { action: "pause", label: t("Pause download"), icon: <Pause size={14} /> },
      { action: "resume", label: t("Resume download"), icon: <Play size={14} /> },
      { action: "cancel", label: t("Cancel download"), icon: <X size={14} /> },
      { action: "retry", label: t("Retry download"), icon: <RotateCcw size={14} /> },
    ];
    for (const control of controls) {
      if (caps[control.action])
        rows.push({
          id: `download:${id}:${control.action}`,
          label: control.label,
          icon: control.icon,
          run: () => runBatch([id], control.action, item.title),
          group: "download",
        });
    }
    if (["error", "interrupted", "canceled"].includes(item.status) && !caps.retry) {
      rows.push({
        id: `download:${id}:retry-unavailable`,
        label: t("Retry download"),
        disabled: true,
        reason: t("Choose a download source again; this item's source cannot be recovered."),
        group: "download",
      });
    }
    rows.push({
      id: `download:${id}:delete`,
      label: caps.printReceipt ? t("Remove from downloads") : t("Delete download and file"),
      icon: <Trash2 size={14} />,
      danger: true,
      disabled: caps.busy,
      reason: caps.busy ? t("Deletion is in progress.") : undefined,
      run: () => runBatch([id], "delete", item.title),
      group: "delete",
    });
    return rows;
  };

  const batchActions = (ids: string[], scope: string, scopeId = scope): ContextAction[] => {
    const options: { action: DownloadBatchAction; label: string }[] = [
      { action: "pause", label: t("Pause {count} downloads") },
      { action: "resume", label: t("Resume {count} downloads") },
      { action: "cancel", label: t("Cancel {count} downloads") },
      { action: "retry", label: t("Retry {count} downloads") },
      { action: "delete", label: t("Delete {count} downloads") },
    ];
    return options.flatMap(({ action, label }) => {
      const eligible = ids.filter((id) => downloadCapabilities(id)?.[action]);
      if (!eligible.length) return [];
      return [
        {
          id: `download-batch:${scopeId}:${action}`,
          label: label.replace("{count}", String(eligible.length)),
          danger: action === "delete",
          group: action === "delete" ? "delete" : "download",
          run: () => runBatch(eligible, action, scope),
        },
      ];
    });
  };

  return { actions, batchActions };
}
