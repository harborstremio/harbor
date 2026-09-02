import { useState } from "react";
import { Loader2, Plus, UsersRound } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { currentAuthor } from "@/lib/theme-auth";
import { useView } from "@/lib/view";
import { CreateGroupModal } from "@/views/profile/create-group-modal";
import { GroupTile } from "./groups/group-tile";
import { GroupsHeroMosaic } from "./groups/hero-mosaic";
import { GroupsEmpty, GroupsError, GroupsSkeleton } from "./groups/groups-states";
import { useGroupDiscovery } from "./groups/use-group-discovery";

export function GroupsView() {
  const t = useT();
  const { openGroup } = useView();
  const signedIn = !!currentAuthor();
  const d = useGroupDiscovery(signedIn);
  const [creating, setCreating] = useState(false);
  const browsing = !!d.q.trim() || !!d.tag;
  const mine = browsing ? [] : d.mine;
  const mineIds = new Set(mine.map((g) => g.id));
  const rest = d.groups.filter((g) => !mineIds.has(g.id));

  return (
    <div className="relative h-full overflow-y-auto bg-canvas">
      <GroupsHeroMosaic groups={[...d.mine, ...d.groups]} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: "linear-gradient(180deg, color-mix(in oklch, var(--color-elevated), transparent 45%), transparent 78%)" }}
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-6 pb-24 pt-28 sm:px-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
                <UsersRound size={14} /> {t("Community")}
              </span>
              <h1 className="font-display text-[38px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[46px]">
                {t("Groups")}
              </h1>
              <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-ink-muted">
                {t("Find people who watch what you watch. Join a group to share lists, post, and watch together.")}
              </p>
            </div>
            {signedIn && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
              >
                <Plus size={16} strokeWidth={2.4} /> {t("Create a group")}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 ring-1 ring-edge-soft transition-[box-shadow,background-color] focus-within:bg-elevated focus-within:ring-edge">
              <Search size={17} className="shrink-0 text-ink-subtle" />
              <input
                value={d.q}
                onChange={(e) => d.setQ(e.target.value)}
                placeholder={t("Search groups by name or tag")}
                className="h-full flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
              />
              {d.phase === "loading" && d.q && <Loader2 size={15} className="shrink-0 animate-spin text-ink-subtle" />}
            </div>
            {d.topTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <TagChip active={!d.tag} label={t("All")} onClick={() => d.setTag(null)} />
                {d.topTags.map((tg) => (
                  <TagChip key={tg} active={d.tag === tg} label={tg} onClick={() => d.setTag(tg === d.tag ? null : tg)} />
                ))}
              </div>
            )}
          </div>
        </header>

        {mine.length > 0 && (
          <Section title={t("Your groups")} count={mine.length}>
            <Grid>
              {mine.map((g, i) => (
                <GroupTile key={g.id} group={g} index={i} onOpen={openGroup} />
              ))}
            </Grid>
          </Section>
        )}

        <Section
          title={browsing ? t("Results") : mine.length > 0 ? t("Discover more") : t("Public groups")}
          count={d.phase === "ready" ? d.total : undefined}
        >
          {d.phase === "loading" ? (
            <GroupsSkeleton count={6} />
          ) : d.phase === "error" ? (
            <GroupsError onRetry={d.reload} />
          ) : rest.length === 0 ? (
            <GroupsEmpty query={d.q.trim()} onCreate={signedIn ? () => setCreating(true) : undefined} />
          ) : (
            <>
              <Grid>
                {rest.map((g, i) => (
                  <GroupTile key={g.id} group={g} index={i} onOpen={openGroup} />
                ))}
              </Grid>
              {d.hasMore && (
                <button
                  type="button"
                  onClick={d.loadMore}
                  disabled={d.loadingMore}
                  className="mx-auto mt-8 flex h-10 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50"
                >
                  {d.loadingMore && <Loader2 size={14} className="animate-spin" />} {t("Load more")}
                </button>
              )}
            </>
          )}
        </Section>
      </div>

      {creating && (
        <CreateGroupModal
          onClose={() => setCreating(false)}
          onCreated={(g) => {
            setCreating(false);
            d.reload();
            openGroup(g.id);
          }}
        />
      )}
    </div>
  );
}

function TagChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
        active
          ? "bg-ink text-canvas"
          : "bg-surface text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-2.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-[12px] tabular-nums text-ink-subtle/70">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
