import { Bookmark, Check, ListVideo, Play, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useSettingsPreviewArt, type PreviewArt } from "@/lib/settings-preview-art";

export type HomeRowKind =
  | "all-addon-rows"
  | "watchlist-saved"
  | "playlists-tab"
  | "anime-room"
  | "cw-advance"
  | "hide-watched";

export function HomeRowPreview({ kind }: { kind: HomeRowKind }) {
  const art = useSettingsPreviewArt();
  switch (kind) {
    case "all-addon-rows":
      return <AllAddonRows />;
    case "watchlist-saved":
      return <WatchlistSaved art={art} />;
    case "playlists-tab":
      return <PlaylistsTab />;
    case "anime-room":
      return <AnimeRoom art={art} />;
    case "cw-advance":
      return <CwAdvance art={art} />;
    case "hide-watched":
      return <HideWatched art={art} />;
  }
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{children}</p>;
}

function Panel({ tag, active, children }: { tag: string; active?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-2.5 ${
        active ? "border-accent/40 bg-accent/[0.07]" : "border-edge-soft/60 bg-canvas/30"
      }`}
    >
      <div
        className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
          active ? "text-accent" : "text-ink-subtle"
        }`}
      >
        {tag}
      </div>
      {children}
    </div>
  );
}

function RailBar({ label, dupe }: { label: string; dupe?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium ${
        dupe ? "bg-accent/15 text-accent ring-1 ring-accent/25" : "bg-canvas/60 text-ink-muted"
      }`}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function MiniPoster({
  faded,
  dashed,
  badge,
  img,
}: {
  faded?: boolean;
  dashed?: boolean;
  badge?: ReactNode;
  img?: string;
}) {
  return (
    <div
      className={`relative h-[52px] w-[34px] shrink-0 rounded-[5px] ${
        img ? "bg-canvas" : "bg-gradient-to-b from-elevated to-canvas"
      } ${dashed ? "border border-dashed border-edge-soft/70" : "ring-1 ring-edge-soft/60"} ${
        faded ? "opacity-30" : ""
      }`}
    >
      {img && (
        <img
          src={img}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full rounded-[5px] object-cover"
        />
      )}
      {badge}
    </div>
  );
}

function AllAddonRows() {
  const t = useT();
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Panel tag={t("Merged")}>
          <RailBar label={t("Trending")} />
          <RailBar label={t("Popular")} />
          <RailBar label={t("Top Rated")} />
        </Panel>
        <Panel tag={t("Every row")} active>
          <RailBar label={t("Trending")} />
          <RailBar label={t("Trending · Cinemeta")} dupe />
          <RailBar label={t("Popular")} />
          <RailBar label={t("Popular · AIO")} dupe />
        </Panel>
      </div>
      <Caption>
        {t("On: addon rails that duplicate the built-ins show too, instead of folding into one.")}
      </Caption>
    </>
  );
}

function WatchlistSaved({ art }: { art: PreviewArt | null }) {
  const t = useT();
  const p = art?.posters ?? [];
  const saved = (
    <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-canvas">
      <Bookmark size={9} strokeWidth={2.6} />
    </span>
  );
  const auto = (
    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b-[5px] bg-black/45 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-ink-muted">
      <Play size={6} strokeWidth={3} /> {t("auto")}
    </span>
  );
  return (
    <>
      <div className="flex items-end gap-2 rounded-lg border border-edge-soft/60 bg-canvas/30 p-2.5">
        <MiniPoster img={p[0]} badge={saved} />
        <MiniPoster img={p[1]} badge={saved} />
        <MiniPoster img={p[2]} badge={saved} />
        <MiniPoster img={p[3]} faded dashed badge={auto} />
        <MiniPoster img={p[4]} faded dashed badge={auto} />
      </div>
      <Caption>
        {t(
          "On: only titles you bookmarked. Off: also keeps the ones Stremio added when you hit play.",
        )}
      </Caption>
    </>
  );
}

function PlaylistsTab() {
  const t = useT();
  const items = [t("Home"), t("Library"), t("Discover")];
  return (
    <>
      <div className="flex flex-col gap-1 rounded-lg border border-edge-soft/60 bg-canvas/30 p-2.5">
        {items.map((it) => (
          <div
            key={it}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-ink-muted"
          >
            <span className="h-3 w-3 rounded-[3px] bg-edge/70" />
            {it}
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-md bg-accent/15 px-2 py-1.5 text-[11px] font-semibold text-accent ring-1 ring-accent/25">
          <ListVideo size={13} />
          {t("Playlists")}
          <Sparkles size={11} className="ms-auto" />
        </div>
      </div>
      <Caption>{t("Adds a Playlists tab to the nav for your M3U and Xtream libraries.")}</Caption>
    </>
  );
}

function AnimeRoom({ art }: { art: PreviewArt | null }) {
  const t = useT();
  const p = art?.posters ?? [];
  const an = art?.anime ?? [];
  return (
    <>
      <div className="rounded-lg border border-edge-soft/60 bg-canvas/30 p-2.5">
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Home · Continue Watching")}
        </div>
        <div className="flex items-center gap-2">
          <MiniPoster img={p[0]} />
          <MiniPoster img={p[1]} />
          <div className="relative">
            <MiniPoster img={an[0]} faded dashed />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-ink-subtle">
              {t("anime")}
            </span>
          </div>
          <span className="inline-block text-ink-subtle rtl:rotate-180">&rarr;</span>
          <span className="rounded-md bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent ring-1 ring-accent/25">
            {t("Anime tab")}
          </span>
        </div>
      </div>
      <Caption>
        {t("Anime leaves Home Continue Watching and stays in the Anime tab's own row.")}
      </Caption>
    </>
  );
}

function CwCard({
  ep,
  meta,
  progress,
  dim,
  still,
}: {
  ep: string;
  meta: string;
  progress: number;
  dim?: boolean;
  still?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-md ring-1 ring-edge-soft/60 ${dim ? "opacity-75" : ""}`}
    >
      <div className="relative h-11 bg-gradient-to-br from-elevated to-canvas">
        {still && (
          <img
            src={still}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute bottom-1 start-1 rounded bg-black/55 px-1 py-0.5 text-[8.5px] font-semibold text-ink">
          {ep}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-edge">
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="px-1.5 py-1 text-[9px] text-ink-subtle">{meta}</div>
    </div>
  );
}

function CwAdvance({ art }: { art: PreviewArt | null }) {
  const t = useT();
  const s = art?.stills ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Panel tag={t("Off")}>
          <CwCard ep="S1 · E4" meta={t("0m left")} progress={100} dim still={s[0]} />
        </Panel>
        <Panel tag={t("On")} active>
          <CwCard ep="S1 · E5" meta={t("24m")} progress={6} still={s[1] ?? s[0]} />
        </Panel>
      </div>
      <Caption>
        {t("Finish an episode and the card jumps to the next one instead of sitting at 0m left.")}
      </Caption>
    </>
  );
}

function HideWatched({ art }: { art: PreviewArt | null }) {
  const t = useT();
  const p = art?.posters ?? [];
  const check = (
    <span className="absolute inset-0 flex items-center justify-center rounded-[5px] bg-black/55">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-canvas">
        <Check size={11} strokeWidth={3} />
      </span>
    </span>
  );
  return (
    <>
      <div className="flex items-end gap-2 rounded-lg border border-edge-soft/60 bg-canvas/30 p-2.5">
        <MiniPoster img={p[3]} />
        <MiniPoster img={p[4]} faded badge={check} />
        <MiniPoster img={p[5]} />
        <MiniPoster img={p[6]} faded badge={check} />
        <MiniPoster img={p[7]} />
      </div>
      <Caption>
        {t(
          "Movies you've finished and shows in progress leave the catalog rows. Continue Watching is never touched.",
        )}
      </Caption>
    </>
  );
}
