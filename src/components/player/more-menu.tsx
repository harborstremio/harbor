import {
  Check,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Magnet,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { magnetFromHash } from "@/lib/debrid/types";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import type { TrackInfo } from "@/lib/player/bridge";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { copyText } from "./copy-link-button";
import { Tooltip } from "./transport/tooltip";
import { watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";

type MoreRowSpec = {
  key: string;
  icon: LucideIcon;
  label: string;
  feedback: "copied" | "saved" | "none";
  run: () => boolean | Promise<boolean>;
};

type MoreMenuProps = {
  visible: boolean;
  streamUrl: string | null;
  infoHash?: string | null;
  selectedSub?: TrackInfo | null;
  onOpenChange?: (open: boolean) => void;
};

export function MoreMenu({
  visible,
  streamUrl,
  infoHash,
  selectedSub,
  onOpenChange,
}: MoreMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    return watchOutsideMouseDown(close);
  }, [open]);

  const httpUrl = streamUrl && /^https?:\/\//i.test(streamUrl) ? streamUrl : null;
  const subUrl = selectedSub?.url ?? null;
  const magnet = infoHash ? magnetFromHash(infoHash) : null;

  const rows: MoreRowSpec[] = [];
  if (subUrl) {
    rows.push({
      key: "sub",
      icon: Download,
      label: t("Download subtitle"),
      feedback: "saved",
      run: () =>
        saveSubtitleToDisk(subUrl, {
          title: selectedSub?.title || selectedSub?.label,
          lang: selectedSub?.lang,
          format: selectedSub?.format,
          downloadAuth: selectedSub?.downloadAuth,
          label: t("Subtitle"),
        }).then((r) => r === "ok"),
    });
  }
  if (httpUrl) {
    rows.push({
      key: "url",
      icon: Link2,
      label: t("Copy stream link"),
      feedback: "copied",
      run: () => copyText(httpUrl),
    });
  }
  if (magnet) {
    rows.push({
      key: "magnet",
      icon: Magnet,
      label: t("Copy magnet link"),
      feedback: "copied",
      run: () => copyText(magnet),
    });
  }
  if (httpUrl) {
    rows.push({
      key: "open",
      icon: ExternalLink,
      label: t("Open stream in browser"),
      feedback: "none",
      run: () => {
        openUrl(httpUrl);
        setOpen(false);
        return true;
      },
    });
  }

  if (rows.length === 0) return null;

  return (
    <div
      className={`absolute end-4 top-20 z-30 transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div ref={wrap} className="relative">
        <Tooltip label={t("More")} side="bottom" align="end">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={t("More options")}
            aria-expanded={open}
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 shadow-[0_14px_40px_-15px_rgba(0,0,0,0.85)] backdrop-blur-md transition-colors ${
              open
                ? "bg-white/22 text-white"
                : "bg-black/65 text-white/90 hover:bg-black/85 hover:text-white"
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={2.2} />
          </button>
        </Tooltip>
        {open && (
          <div className="absolute end-0 top-[calc(100%+10px)] w-64 max-w-[calc(100vw-32px)] overflow-hidden rounded-md bg-elevated p-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
            {rows.map((r) => (
              <MoreRow key={r.key} spec={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MoreRow({ spec }: { spec: MoreRowSpec }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const Icon = spec.icon;
  const doneLabel = spec.feedback === "saved" ? t("Saved to disk") : t("Copied");

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await Promise.resolve(spec.run());
      if (ok !== false && spec.feedback !== "none") {
        setDone(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(false), 1500);
      }
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-[13.5px] text-ink-muted transition-colors hover:bg-canvas/55 hover:text-ink"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center ${done ? "text-success" : "text-ink-subtle"}`}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : done ? (
          <Check size={16} strokeWidth={2.6} />
        ) : (
          <Icon size={16} strokeWidth={2} />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{done ? doneLabel : spec.label}</span>
    </button>
  );
}
