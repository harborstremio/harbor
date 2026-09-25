import {
  AudioLines,
  Download,
  ExternalLink,
  Link2,
  Magnet,
  Maximize,
  Settings,
} from "lucide-react";
import type { ActionSource, ContextAction } from "@/lib/context-actions";
import type { PlayerActions } from "@/lib/player-actions";
import { t } from "@/lib/i18n";
import { openLinkOut } from "@/lib/social/link-out";
import { copyContextText } from "./content-actions";

/** Reads the active session again at invocation; source changes never reuse an old URL. */
export function playerContextSources(
  readCurrent: () => PlayerActions | null,
  readSettings: () => ContextAction | undefined,
): { quick: ActionSource; rows: ActionSource } {
  const isValid = () => readCurrent() != null;
  return {
    quick: {
      isValid,
      actions: () => {
        const player = readCurrent();
        if (!player) return [];
        const actions: ContextAction[] = [];
        if (player.magnetUrl)
          actions.push({
            id: "player:copy-magnet",
            label: t("Copy magnet"),
            icon: <Magnet size={16} strokeWidth={2} />,
            run: () => copyContextText(player.magnetUrl!),
          });
        const settings = readSettings();
        if (settings)
          actions.push({
            ...settings,
            id: "player:settings",
            label: t("Settings"),
            icon: settings.icon ?? <Settings size={16} strokeWidth={2} />,
            restoreFocus: false,
          });
        return actions;
      },
    },
    rows: {
      isValid,
      actions: () => {
        const player = readCurrent();
        if (!player) return [];
        const actions: ContextAction[] = [
          {
            id: "player:fullscreen",
            label: t("Full screen"),
            icon: <Maximize size={16} strokeWidth={2} />,
            run: player.toggleFullscreen,
            group: "tools",
          },
        ];
        if (player.canDownload)
          actions.push({
            id: "player:download-video",
            label: t("Download Video"),
            icon: <Download size={16} strokeWidth={2} />,
            run: player.download,
            restoreFocus: false,
            group: "tools",
          });
        if (player.canDownloadSubtitle)
          actions.push({
            id: "player:download-subtitle",
            label: t("Download Subtitle"),
            icon: <Download size={16} strokeWidth={2} />,
            run: player.downloadSubtitle,
            group: "tools",
          });
        if (player.liveSync)
          actions.push({
            id: "player:live-sync",
            label: t("Live sync"),
            icon: <AudioLines size={16} strokeWidth={2} />,
            run: player.liveSync,
            disabled: !player.canLiveSync,
            reason: player.canLiveSync ? undefined : t("Select a subtitle track first."),
            restoreFocus: false,
            group: "tools",
          });
        const httpUrl =
          player.streamUrl && /^https?:\/\//i.test(player.streamUrl) ? player.streamUrl : null;
        if (httpUrl)
          actions.push(
            {
              id: "player:copy-stream",
              label: t("Copy stream link"),
              icon: <Link2 size={16} strokeWidth={2} />,
              run: () => copyContextText(httpUrl),
              group: "links",
            },
            {
              id: "player:open-browser",
              label: t("Open in browser"),
              icon: <ExternalLink size={16} strokeWidth={2} />,
              run: () => openLinkOut(httpUrl),
              group: "links",
            },
          );
        return actions;
      },
    },
  };
}
