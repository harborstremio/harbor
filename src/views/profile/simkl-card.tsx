import { ExternalLink, Link2, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import simklLogo from "@/assets/simkl.png";
import { SimklDeviceModal } from "@/components/simkl/simkl-device-modal";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { openLinkOut } from "@/lib/social/link-out";
import { socialPatch } from "@/lib/social/client";
import type { SimklAccountType, SimklProfile, SimklProfileStats } from "@/lib/simkl/profile";
import { Avatar, compactNumber, timeAgo } from "./profile-bits";
import type { SimklPublished } from "./profile-types";
import { useSimklCard } from "./use-simkl-card";

const TILE =
  "flex flex-col items-center rounded-[10px] bg-elevated px-2 py-2.5 ring-1 ring-edge-soft";
const LABEL = "text-[10.5px] uppercase tracking-[0.1em] text-ink-subtle";
const CENTERED = "flex flex-col items-center gap-3.5 px-5 py-5 text-center";

function SimklMark({ size }: { size: number }) {
  return (
    <img
      src={simklLogo}
      alt=""
      draggable={false}
      className="shrink-0 object-contain ring-1 ring-edge-soft"
      style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.26)) }}
    />
  );
}

function VipChip({ plus }: { plus: boolean }) {
  return (
    <span className="inline-flex items-center rounded-[6px] bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-accent">
      {plus ? "VIP+" : "VIP"}
    </span>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className={TILE}>
      <span className="text-[17px] font-semibold tabular-nums text-ink">
        {compactNumber(value)}
      </span>
      <span className={LABEL}>{label}</span>
    </div>
  );
}

function StatsRow({ stats }: { stats: SimklProfileStats }) {
  const t = useT();
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile value={stats.moviesCompleted} label={t("Movies")} />
      <StatTile value={stats.showsCompleted} label={t("Shows")} />
      <StatTile value={stats.totalCompleted} label={t("Watched")} />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="harbor-skel h-[54px] rounded-[10px] bg-elevated" />
      ))}
    </div>
  );
}

function Identity({
  profile,
  username,
  lastWatchedAt,
  isOwner,
}: {
  profile: SimklProfile | null;
  username: string | null;
  lastWatchedAt: string | null;
  isOwner: boolean;
}) {
  const t = useT();
  const name = profile?.displayName || username || "";
  const url =
    profile?.profileUrl || (username ? `https://simkl.com/${encodeURIComponent(username)}` : "");
  const vip = profile?.accountType === "vip" || profile?.accountType === "vip_plus";
  const sub = lastWatchedAt
    ? t("Last watched {when}", { when: timeAgo(lastWatchedAt) })
    : username && username !== name
      ? `@${username}`
      : "";
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => openLinkOut(url)}
      aria-label={url ? t("Open Simkl profile") : undefined}
      className={`group flex min-h-[86px] w-full shrink-0 items-center gap-3.5 bg-canvas/40 px-4 text-start ${
        url ? "transition-colors hover:bg-canvas/70" : "cursor-default"
      }`}
    >
      <Avatar src={profile?.avatarUrl ?? undefined} size={54} alias={name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
            {isOwner ? t("Connected") : t("On Simkl")}
          </span>
          {vip && <VipChip plus={profile?.accountType === "vip_plus"} />}
        </span>
        {name ? (
          <span className="mt-0.5 block truncate font-display text-[19px] leading-tight text-ink">
            {name}
          </span>
        ) : (
          <span className="harbor-skel mt-1.5 block h-5 w-32 max-w-full rounded-[8px] bg-elevated" />
        )}
        {sub && <span className="mt-0.5 block truncate text-[12.5px] text-ink-subtle">{sub}</span>}
      </span>
      {!!url && (
        <ExternalLink
          size={15}
          className="shrink-0 text-ink-subtle opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      )}
    </button>
  );
}

function PublishedSimklCard({
  published,
  hideTitle,
}: {
  published: SimklPublished;
  hideTitle?: boolean;
}) {
  const t = useT();
  const profile: SimklProfile = {
    userId: null,
    displayName: published.displayName,
    avatarUrl: published.avatar,
    joinedAt: null,
    bio: null,
    location: null,
    gender: null,
    accountType: (published.accountType as SimklAccountType) || "unknown",
    profileUrl: published.profileUrl,
  };
  const stats = published.stats;
  return (
    <section
      aria-label={t("Simkl")}
      className="overflow-hidden rounded-[14px] bg-surface ring-1 ring-edge-soft"
    >
      {!hideTitle && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <SimklMark size={20} /> {t("Simkl")}
        </div>
      )}
      <div className="flex min-h-[172px] flex-col justify-center">
        <Identity
          profile={profile}
          username={published.username}
          lastWatchedAt={stats?.lastWatchedAt ?? null}
          isOwner={false}
        />
        <div className="px-4 py-4">
          {stats ? (
            <StatsRow stats={stats} />
          ) : (
            <p className="flex h-[54px] items-center justify-center text-center text-[13px] text-ink-subtle">
              {t("Nothing tracked on Simkl yet")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function SimklCard({
  isOwner,
  hideTitle,
  published,
}: {
  isOwner: boolean;
  hideTitle?: boolean;
  published?: SimklPublished | null;
}) {
  const t = useT();
  const { openSettings } = useView();
  const [connecting, setConnecting] = useState(false);
  const { state, username, reload } = useSimklCard({ includeStats: isOwner, enabled: isOwner });

  const pushedRef = useRef("");
  useEffect(() => {
    if (!isOwner) return;
    let snap: SimklPublished | null;
    if (state.kind === "ready") {
      const s = state.stats.kind === "ready" ? state.stats.stats : null;
      snap = {
        username: username || null,
        displayName: state.profile.displayName || null,
        avatar: state.profile.avatarUrl || null,
        profileUrl: state.profile.profileUrl || null,
        accountType: state.profile.accountType || null,
        stats: s
          ? {
              moviesCompleted: s.moviesCompleted,
              showsCompleted: s.showsCompleted,
              totalCompleted: s.totalCompleted,
              lastWatchedAt: s.lastWatchedAt,
            }
          : null,
      };
    } else if (state.kind === "disconnected") {
      snap = null;
    } else {
      return;
    }
    const key = JSON.stringify(snap);
    if (key === pushedRef.current) return;
    pushedRef.current = key;
    void socialPatch("/social/me/profile", { simkl: snap }).catch(() => {});
  }, [isOwner, state, username]);

  if (!isOwner) {
    if (!published || (!published.displayName && !published.username)) return null;
    return <PublishedSimklCard published={published} hideTitle={hideTitle} />;
  }

  const profile = state.kind === "ready" ? state.profile : null;

  const lastWatched =
    state.kind === "ready" && state.stats.kind === "ready" && state.stats.stats.lastWatchedAt
      ? state.stats.stats.lastWatchedAt
      : null;

  const body =
    state.kind === "disconnected" ? (
      <div className={CENTERED}>
        <SimklMark size={44} />
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t("Link Simkl and everything you watch shows up right here.")}
        </p>
        <button
          type="button"
          onClick={() => setConnecting(true)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-ink px-4 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
        >
          <Link2 size={16} strokeWidth={2.2} /> {t("Connect Simkl")}
        </button>
      </div>
    ) : state.kind === "error" ? (
      <div className={CENTERED} title={state.detail}>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t("Could not reach Simkl.")}
        </p>
        {state.retryable && (
          <button
            type="button"
            onClick={reload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <RefreshCw size={15} strokeWidth={2.2} /> {t("Try again")}
          </button>
        )}
      </div>
    ) : (
      <>
        <Identity
          profile={profile}
          username={username}
          lastWatchedAt={lastWatched}
          isOwner={isOwner}
        />
        <div className="px-4 py-4">
          {state.kind === "loading" || state.stats.kind === "loading" ? (
            <StatsSkeleton />
          ) : state.stats.kind === "ready" ? (
            <StatsRow stats={state.stats.stats} />
          ) : (
            <p className="flex h-[54px] items-center justify-center text-center text-[13px] text-ink-subtle">
              {t("Nothing tracked on Simkl yet")}
            </p>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => openSettings("simkl")}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-edge-soft text-[13px] font-medium text-ink-subtle transition-colors hover:border-edge hover:text-ink"
            >
              <Settings2 size={14} strokeWidth={2.2} /> {t("Manage connection")}
            </button>
          )}
        </div>
      </>
    );

  return (
    <>
      <section
        aria-label={t("Simkl")}
        className="overflow-hidden rounded-[14px] bg-surface ring-1 ring-edge-soft"
      >
        {!hideTitle && (
          <div className="flex items-center gap-2 px-4 pb-3 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            <SimklMark size={20} /> {t("Simkl")}
          </div>
        )}
        <div className="flex min-h-[172px] flex-col justify-center">{body}</div>
      </section>
      {connecting && <SimklDeviceModal onClose={() => setConnecting(false)} />}
    </>
  );
}
