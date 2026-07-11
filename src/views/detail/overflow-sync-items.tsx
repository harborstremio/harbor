import anilistLogo from "@/assets/anilist.png";
import simklLogo from "@/assets/simkl.png";
import traktLogo from "@/assets/trakt.png";
import { deleteListEntry, fetchListEntry, saveListEntry } from "@/lib/anilist/mutations";
import { useAnilist } from "@/lib/anilist/provider";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { MediaListStatus } from "@/lib/anilist/types";
import { useT } from "@/lib/i18n";
import { resolveSimklTarget } from "@/lib/simkl/ids";
import {
  clearSimklStatus,
  loadSimklStatusMap,
  MOVIE_STATUS_ORDER,
  setSimklStatus,
  SHOW_STATUS_ORDER,
  SIMKL_STATUS_LABELS,
  statusForId,
  type WatchlistStatus,
} from "@/lib/simkl/list-status";
import { useSimkl } from "@/lib/simkl/provider";
import type { SimklTarget } from "@/lib/simkl/types";
import { pushWatched } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const ANILIST_LABELS: Record<MediaListStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  REPEATING: "Rewatching",
  PAUSED: "On Hold",
  DROPPED: "Dropped",
};

const ANILIST_ORDER: MediaListStatus[] = ["CURRENT", "PLANNING", "COMPLETED", "REPEATING", "PAUSED", "DROPPED"];

function GroupRow({ logo, label, open, onClick }: { logo: string; label: string; open: boolean; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink transition-colors hover:bg-raised"
    >
      <img src={logo} alt="" className="h-[14px] w-[14px] rounded-[3px] object-contain" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronDown size={13} className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

function StatusRow({
  label,
  active,
  danger,
  onClick,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex h-8 items-center justify-between gap-2 rounded-lg py-1 ps-9 pe-3 text-start text-[12.5px] transition-colors ${
        danger
          ? "text-ink-muted hover:bg-danger/15 hover:text-danger"
          : active
            ? "text-ink"
            : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      <span className="flex items-center gap-2">
        {danger && <Trash2 size={12} />}
        {label}
      </span>
      {active && <Check size={13} className="text-ink" />}
    </button>
  );
}

export function SimklMenuItems({
  harborId,
  type,
  onAction,
}: {
  harborId: string;
  type: "movie" | "series";
  onAction: () => void;
}) {
  const t = useT();
  const { isConnected } = useSimkl();
  const [target, setTarget] = useState<SimklTarget | null>(null);
  const [status, setStatus] = useState<WatchlistStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    void (async () => {
      const t = await resolveSimklTarget(harborId, type);
      if (cancelled || !t) return;
      setTarget(t);
      const malKey = "ids" in t && t.ids.mal != null ? `mal:${t.ids.mal}` : null;
      try {
        const m = await loadSimklStatusMap();
        if (cancelled) return;
        setStatus(statusForId(m, harborId) ?? (malKey ? statusForId(m, malKey) : null));
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, type]);

  if (!isConnected || !target || !ready) return null;
  const order = target.kind === "movie" ? MOVIE_STATUS_ORDER : SHOW_STATUS_ORDER;

  if (status == null) {
    return (
      <GroupRow
        logo={simklLogo}
        label={t("Add to Simkl")}
        open={false}
        onClick={() => {
          void setSimklStatus(target, "plantowatch").catch(() => {});
          onAction();
        }}
      />
    );
  }
  return (
    <>
      <GroupRow
        logo={simklLogo}
        label={`Simkl  ·  ${t(SIMKL_STATUS_LABELS[status])}`}
        open={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {order.map((s) => (
            <StatusRow
              key={s}
              label={t(SIMKL_STATUS_LABELS[s])}
              active={s === status}
              onClick={() => {
                void setSimklStatus(target, s).catch(() => {});
                onAction();
              }}
            />
          ))}
          <StatusRow
            label={t("Remove from list")}
            danger
            onClick={() => {
              void clearSimklStatus(target).catch(() => {});
              onAction();
            }}
          />
        </>
      )}
    </>
  );
}

export function AnilistMenuItems({ harborId, onAction }: { harborId: string; onAction: () => void }) {
  const t = useT();
  const { isConnected } = useAnilist();
  const [mediaId, setMediaId] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<number | null>(null);
  const [status, setStatus] = useState<MediaListStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    (async () => {
      const id = await resolveAnilistMediaId(harborId);
      if (cancelled) return;
      if (id == null) {
        setReady(false);
        return;
      }
      setMediaId(id);
      const info = await fetchListEntry(id).catch(() => null);
      if (cancelled) return;
      setEntryId(info?.entry?.id ?? null);
      setStatus(info?.entry?.status ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected]);

  if (!isConnected || !ready || mediaId == null) return null;

  if (status == null) {
    return (
      <GroupRow
        logo={anilistLogo}
        label={t("Add to AniList")}
        open={false}
        onClick={() => {
          void saveListEntry({ mediaId, status: "PLANNING" }).catch(() => {});
          onAction();
        }}
      />
    );
  }
  return (
    <>
      <GroupRow
        logo={anilistLogo}
        label={`AniList  ·  ${t(ANILIST_LABELS[status])}`}
        open={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {ANILIST_ORDER.map((s) => (
            <StatusRow
              key={s}
              label={t(ANILIST_LABELS[s])}
              active={s === status}
              onClick={() => {
                void saveListEntry({ mediaId, status: s }).catch(() => {});
                onAction();
              }}
            />
          ))}
          {entryId != null && (
            <StatusRow
              label={t("Remove from list")}
              danger
              onClick={() => {
                void deleteListEntry(entryId).catch(() => {});
                onAction();
              }}
            />
          )}
        </>
      )}
    </>
  );
}

export function TraktMenuItems({
  harborId,
  type,
  onAction,
}: {
  harborId: string;
  type: "movie" | "series";
  onAction: () => void;
}) {
  const t = useT();
  const { isConnected, resolveTarget } = useTrakt();
  if (!isConnected || type !== "movie") return null;
  const target = resolveTarget(harborId);
  if (!target || target.kind !== "movie") return null;
  return (
    <button
      role="menuitem"
      onClick={() => {
        void pushWatched(target).catch(() => {});
        onAction();
      }}
      className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink transition-colors hover:bg-raised"
    >
      <img src={traktLogo} alt="" className="h-[14px] w-[14px] rounded-[3px] object-contain" />
      <span className="flex-1 truncate">{t("Mark watched on Trakt")}</span>
    </button>
  );
}
