import { ExternalLink, Link2, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { openLinkOut } from "@/lib/social/link-out";
import { socialPatch } from "@/lib/social/client";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { compactNumber } from "./profile-bits";
import type { LetterboxdPublished, LetterboxdPublishedList } from "./profile-types";

const TILE = "flex flex-col items-center rounded-md bg-elevated px-2 py-2.5 ring-1 ring-edge-soft";
const LABEL = "text-[10.5px] uppercase tracking-[0.1em] text-ink-subtle";
const CENTERED = "flex flex-col items-center gap-3.5 px-5 py-5 text-center";

const MAX_LISTS = 4;

function profileUrlFor(username: string): string {
  return `https://letterboxd.com/${encodeURIComponent(username)}/`;
}

function normalize(p: LetterboxdPublished): LetterboxdPublished {
  const lists = (Array.isArray(p.lists) ? p.lists : [])
    .filter((l): l is LetterboxdPublishedList => !!l && typeof l.name === "string")
    .slice(0, MAX_LISTS);
  return {
    username: p.username ?? null,
    displayName: p.displayName ?? null,
    profileUrl: p.profileUrl ?? null,
    listCount: Number.isFinite(p.listCount) ? p.listCount : lists.length,
    filmCount: Number.isFinite(p.filmCount) ? p.filmCount : 0,
    lists,
  };
}

function LetterboxdMark({ size }: { size: number }) {
  return (
    <img
      src={letterboxdLogo}
      alt=""
      draggable={false}
      className="shrink-0 object-contain ring-1 ring-edge-soft"
      style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.26)) }}
    />
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

function Identity({
  displayName,
  username,
  profileUrl,
  isOwner,
}: {
  displayName: string | null;
  username: string | null;
  profileUrl: string | null;
  isOwner: boolean;
}) {
  const t = useT();
  const name = displayName || username || "";
  const url = profileUrl || (username ? profileUrlFor(username) : "");
  const sub = username && username !== name ? `@${username}` : "";
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => openLinkOut(url)}
      aria-label={url ? t("Open Letterboxd profile") : undefined}
      className={`group flex min-h-[86px] w-full shrink-0 items-center gap-3.5 bg-canvas/40 px-4 text-start ${
        url ? "transition-colors hover:bg-canvas/70" : "cursor-default"
      }`}
    >
      <LetterboxdMark size={54} />
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
          {isOwner ? t("Connected") : t("On Letterboxd")}
        </span>
        <span className="mt-0.5 block truncate font-display text-[19px] leading-tight text-ink">
          {name}
        </span>
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

function ListRow({ list }: { list: LetterboxdPublishedList }) {
  const t = useT();
  const count = list.filmCount ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2 ring-1 ring-inset ring-edge-soft">
      <span className="min-w-0 truncate text-[12.5px] text-ink-muted">{list.name}</span>
      {count > 0 && (
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-subtle">
          {t("{n} films", { n: count })}
        </span>
      )}
    </div>
  );
}

function Body({
  data,
  isOwner,
}: {
  data: LetterboxdPublished;
  isOwner: boolean;
}) {
  const t = useT();
  const { openSettings } = useView();
  return (
    <>
      <Identity
        displayName={data.displayName}
        username={data.username}
        profileUrl={data.profileUrl}
        isOwner={isOwner}
      />
      <div className="space-y-2 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <StatTile value={data.listCount} label={t("Lists")} />
          <StatTile value={data.filmCount} label={t("Films")} />
        </div>
        {data.lists.length > 0 ? (
          data.lists.map((l) => <ListRow key={l.id || l.name} list={l} />)
        ) : (
          <p className="flex h-[38px] items-center justify-center text-center text-[13px] text-ink-subtle">
            {t("No Letterboxd lists shared yet")}
          </p>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => openSettings("letterboxd")}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-edge-soft text-[13px] font-medium text-ink-subtle transition-colors hover:border-edge hover:text-ink active:scale-[0.98]"
          >
            <Settings2 size={14} strokeWidth={2.2} /> {t("Manage connection")}
          </button>
        )}
      </div>
    </>
  );
}

function Shell({
  hideTitle,
  children,
}: {
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section
      aria-label={t("Letterboxd")}
      className="overflow-hidden rounded-lg bg-surface ring-1 ring-edge-soft"
    >
      {!hideTitle && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <LetterboxdMark size={20} /> {t("Letterboxd")}
        </div>
      )}
      <div className="flex min-h-[172px] flex-col justify-center">{children}</div>
    </section>
  );
}

export function LetterboxdCard({
  isOwner,
  hideTitle,
  published,
}: {
  isOwner: boolean;
  hideTitle?: boolean;
  published?: LetterboxdPublished | null;
}) {
  const t = useT();
  const { openSettings } = useView();
  const lb = useLetterboxd();

  const local = useMemo<LetterboxdPublished | null>(() => {
    if (!isOwner || !lb.isActive) return null;
    const username = (lb.session?.username || lb.username || "").trim();
    if (!username) return null;
    const refs = lb.session?.lists?.length ? lb.session.lists : lb.listRefs;
    return {
      username,
      displayName: lb.session?.displayName || null,
      profileUrl: profileUrlFor(username),
      listCount: refs.length,
      filmCount: refs.reduce((n, r) => n + (r.filmCount ?? 0), 0),
      lists: refs.slice(0, MAX_LISTS).map((r) => ({
        id: r.id,
        name: r.name,
        ...(r.filmCount != null ? { filmCount: r.filmCount } : {}),
      })),
    };
  }, [isOwner, lb.isActive, lb.username, lb.session, lb.listRefs]);

  const pushedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOwner) return;
    const key = JSON.stringify(local);
    if (key === pushedRef.current) return;
    pushedRef.current = key;
    void socialPatch("/social/me/profile", { letterboxd: local }).catch(() => {});
  }, [isOwner, local]);

  if (!isOwner) {
    if (!published || (!published.username && !published.displayName)) return null;
    return (
      <Shell hideTitle={hideTitle}>
        <Body data={normalize(published)} isOwner={false} />
      </Shell>
    );
  }

  if (!local) {
    return (
      <Shell hideTitle={hideTitle}>
        <div className={CENTERED}>
          <LetterboxdMark size={44} />
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {t("Link Letterboxd and the films and lists you keep there show up right here.")}
          </p>
          <button
            type="button"
            onClick={() => openSettings("letterboxd")}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Link2 size={16} strokeWidth={2.2} /> {t("Connect Letterboxd")}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell hideTitle={hideTitle}>
      <Body data={local} isOwner />
    </Shell>
  );
}
