import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  torrentEnginePause,
  torrentEngineRemove,
  torrentEngineResume,
  type TorrentListItem,
} from "@/lib/torrent/local-engine";
import { fmtBytes, fmtSpeed } from "./downloads-format";

export function ActiveTorrentRow({
  item,
  onRun,
}: {
  item: TorrentListItem;
  onRun: (p: Promise<void>) => void;
}) {
  const t = useT();
  const pct = item.total > 0 ? Math.min(100, Math.round((item.downloaded / item.total) * 100)) : 0;
  const done = item.finished || pct >= 100;
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[14px] font-medium text-ink">{item.name}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${done ? "bg-success" : "bg-accent"}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-ink-muted">
          <span>{pct}%</span>
          {item.total > 0 && (
            <span className="text-ink-subtle">
              {fmtBytes(item.downloaded)} / {fmtBytes(item.total)}
            </span>
          )}
          {done ? (
            <span className="text-ink-subtle">· {t("Downloaded")}</span>
          ) : item.paused ? (
            <span>· {t("Paused")}</span>
          ) : (
            item.downloadSpeed > 0 && <span>· {fmtSpeed(item.downloadSpeed)}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!done &&
          (item.paused ? (
            <IconBtn label={t("Resume")} onClick={() => onRun(torrentEngineResume(item.infoHash))}>
              <Play size={16} fill="currentColor" strokeWidth={0} />
            </IconBtn>
          ) : (
            <IconBtn label={t("Pause")} onClick={() => onRun(torrentEnginePause(item.infoHash))}>
              <Pause size={16} strokeWidth={2.2} />
            </IconBtn>
          ))}
        {armed ? (
          <button
            type="button"
            onClick={() => {
              window.clearTimeout(armTimer.current);
              setArmed(false);
              onRun(torrentEngineRemove(item.infoHash, true));
            }}
            title={t("Deletes every episode cached for this source")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 text-[11.5px] font-semibold text-danger transition duration-150 hover:bg-danger/25 active:scale-95"
          >
            <Trash2 size={14} strokeWidth={2.2} />
            {t("Delete all")}
          </button>
        ) : (
          <IconBtn
            label={t("Remove cached source (all episodes)")}
            onClick={() => {
              setArmed(true);
              armTimer.current = window.setTimeout(() => setArmed(false), 3200);
            }}
          >
            <Trash2 size={16} strokeWidth={2} />
          </IconBtn>
        )}
      </div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition duration-150 hover:bg-ink/10 hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}
