import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Download } from "./icons";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { LottiePlayer } from "@/components/lottie-player";
import { Section } from "./shared";
import { ROW_DESC } from "./kit";
import { AssetDownloadFeedback, useAssetDownload, type AssetDownload } from "./asset-download";

import abiyyuAvatar from "@/assets/artists/abiyyu.webp";
import stassAvatar from "@/assets/artists/stass-motion.jpg";

type Glob = Record<string, string>;
type LazyGlob = Record<string, () => Promise<unknown>>;

const NAV_URL = import.meta.glob("../../assets/nav-icons/*.svg", { eager: true, query: "?url", import: "default" }) as Glob;
const UI_ALL = import.meta.glob("../../assets/ui-icons/*.svg", { eager: true, query: "?url", import: "default" }) as Glob;
const NOT_OURS = ["help", "remindme"];
const UI_URL: Glob = Object.fromEntries(
  Object.entries(UI_ALL).filter(([key]) => {
    const name = key.split("/").pop()?.replace(".svg", "") ?? "";
    return !NOT_OURS.includes(name);
  }),
);

const PLAYER_URL: Glob = {
  "/player-icons/anime4k.svg": "/player-icons/anime4k.svg",
  "/player-icons/aspect.svg": "/player-icons/aspect.svg",
  "/player-icons/audio.svg": "/player-icons/audio.svg",
  "/player-icons/back.svg": "/player-icons/back.svg",
  "/player-icons/cast--connected.svg": "/player-icons/cast--connected.svg",
  "/player-icons/cast--idle.svg": "/player-icons/cast--idle.svg",
  "/player-icons/download--complete.svg": "/player-icons/download--complete.svg",
  "/player-icons/download--downloading.svg": "/player-icons/download--downloading.svg",
  "/player-icons/download--error.svg": "/player-icons/download--error.svg",
  "/player-icons/download--idle.svg": "/player-icons/download--idle.svg",
  "/player-icons/draw-toggle--active.svg": "/player-icons/draw-toggle--active.svg",
  "/player-icons/draw-toggle--inactive.svg": "/player-icons/draw-toggle--inactive.svg",
  "/player-icons/dvr--idle.svg": "/player-icons/dvr--idle.svg",
  "/player-icons/dvr--recording.svg": "/player-icons/dvr--recording.svg",
  "/player-icons/fullscreen--fullscreen.svg": "/player-icons/fullscreen--fullscreen.svg",
  "/player-icons/fullscreen--windowed.svg": "/player-icons/fullscreen--windowed.svg",
  "/player-icons/next-episode.svg": "/player-icons/next-episode.svg",
  "/player-icons/pick-another.svg": "/player-icons/pick-another.svg",
  "/player-icons/pip--active.svg": "/player-icons/pip--active.svg",
  "/player-icons/pip--inactive.svg": "/player-icons/pip--inactive.svg",
  "/player-icons/play-pause--paused.svg": "/player-icons/play-pause--paused.svg",
  "/player-icons/play-pause--playing.svg": "/player-icons/play-pause--playing.svg",
  "/player-icons/prev-episode.svg": "/player-icons/prev-episode.svg",
  "/player-icons/rtx-hdr.svg": "/player-icons/rtx-hdr.svg",
  "/player-icons/rtx-vsr.svg": "/player-icons/rtx-vsr.svg",
  "/player-icons/screenshot.svg": "/player-icons/screenshot.svg",
  "/player-icons/seek-back.svg": "/player-icons/seek-back.svg",
  "/player-icons/seek-forward.svg": "/player-icons/seek-forward.svg",
  "/player-icons/shader.svg": "/player-icons/shader.svg",
  "/player-icons/song-id.svg": "/player-icons/song-id.svg",
  "/player-icons/speed.svg": "/player-icons/speed.svg",
  "/player-icons/subtitle.svg": "/player-icons/subtitle.svg",
  "/player-icons/volume--mute.svg": "/player-icons/volume--mute.svg",
  "/player-icons/volume.svg": "/player-icons/volume.svg",
};

const SVG_RAW = import.meta.glob([
  "../../assets/nav-icons/*.svg",
  "../../assets/ui-icons/*.svg",
], {
  query: "?raw",
  import: "default",
}) as LazyGlob;

const LOTTIE_NAV = import.meta.glob("../../assets/lottie/nav/*.json") as LazyGlob;
const LOTTIE_MAIN = import.meta.glob("../../assets/lottie/*.json") as LazyGlob;
const LOTTIE_APP: LazyGlob = {
  "../../assets/harbor-lottie.json": () => import("../../assets/harbor-lottie.json"),
  "../../../installer/ui/assets/boot-box.json": () =>
    import("../../../installer/ui/assets/boot-box.json"),
};

function stem(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file.slice(0, file.lastIndexOf("."));
}

const NAMES: Record<string, string> = {
  livetv: "Live TV",
  "live-tv": "Live TV",
  tv: "TV",
  xray: "X-Ray",
  ebook: "eBook",
  "wt-waiting-dark": "Watch together (dark)",
  "wt-waiting-white": "Watch together (light)",
  "addons-boat-dark": "Addons boat (dark)",
  "addons-boat-white": "Addons boat (light)",
  "install-boat-white": "Install boat",
  "harbor-loader": "Harbor loader",
  "flame-streak": "Flame streak",
  "voyage-boat": "Voyage boat",
  "mark-unwatched": "Mark unwatched",
  "mark-watched": "Mark watched",
  "customize-subtitles": "Customize subtitles",
  "all-addons": "All addons",
  "play-filled": "Play",
  "skip-fwd": "Skip forward",
  "save-banner": "Save banner",
  "watch-together": "Watch together",
  "auto-sync": "Auto sync",
  "manual-offset": "Manual offset",
  "thumbs-up": "Thumbs up",
};

function pretty(name: string): string {
  const known = NAMES[name];
  if (known) return known;
  const words = name.split(/[-_]/g).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function entries(glob: Glob): Array<{ key: string; name: string; url: string }> {
  return Object.keys(glob)
    .sort()
    .map((k) => ({ key: k, name: stem(k), url: glob[k] }));
}

function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (rows) => setInView(rows.some((row) => row.isIntersecting)),
      { root: el.closest(".hset-main") },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

function IconTile({
  item,
  saved,
  pending,
  disabled,
  onSave,
}: {
  item: { key: string; name: string; url: string };
  saved: boolean;
  pending: boolean;
  disabled: boolean;
  onSave: (key: string, name: string) => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className="hset-icon-tile aria-disabled:cursor-wait aria-disabled:opacity-60"
      onClick={() => { if (!disabled) onSave(item.key, item.name); }}
      aria-disabled={disabled}
      aria-busy={pending}
      aria-label={t("Save {name} as SVG", { name: pretty(item.name) })}
      title={t("Save as SVG")}
    >
      <span className="hset-icon-art">
        <span
          aria-hidden
          className="hset-icon-mask"
          style={{ maskImage: `url("${item.url}")`, WebkitMaskImage: `url("${item.url}")` }}
        />
        <span className="hset-icon-save" aria-hidden>
          {saved ? <Check size={14} strokeWidth={2.75} /> : <Download size={14} strokeWidth={2.25} />}
        </span>
      </span>
      <span className="hset-icon-name">{pretty(item.name)}</span>
    </button>
  );
}

function IconSet({ glob, download }: { glob: Glob; download: AssetDownload }) {
  const items = useMemo(() => entries(glob), [glob]);
  const save = useCallback(
    (key: string, name: string) => {
      void download.save(key, `${name}.svg`, async () => {
        const load = SVG_RAW[key];
        if (load) return (await load()) as string;
        if (!key.startsWith("/")) throw new Error("Icon source unavailable");
        const res = await fetch(key);
        if (!res.ok) throw new Error("Icon source unavailable");
        return res.text();
      }, ["svg"], "SVG");
    },
    [download.save],
  );
  return (
    <>
      <div className="hset-icon-grid">
        {items.map((it) => (
          <IconTile
            key={it.key}
            item={it}
            saved={download.savedId === it.key}
            pending={download.pendingId === it.key}
            disabled={download.pendingId !== null}
            onSave={save}
          />
        ))}
      </div>
      <AssetDownloadFeedback status={download.status && items.some((it) => it.key === download.status?.id) ? download.status : null} />
    </>
  );
}

function AnimationTile({
  path,
  load,
  saved,
  pending,
  disabled,
  onSave,
}: {
  path: string;
  load: () => Promise<unknown>;
  saved: boolean;
  pending: boolean;
  disabled: boolean;
  onSave: (path: string, name: string, data: object) => void;
}) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const [ref, inView] = useInView<HTMLButtonElement>();
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);
  const name = stem(path);

  useEffect(() => {
    if (!inView || data || failed) return;
    let alive = true;
    void load().then((mod) => {
      if (!alive) return;
      const m = mod as { default?: object };
      setData(m.default ?? (mod as object));
    }).catch(() => {
      if (alive) setFailed(true);
    });
    return () => { alive = false; };
  }, [inView, data, failed, load]);

  const loading = !data && !failed;
  const action = failed
    ? t("Retry loading {name}", { name: pretty(name) })
    : loading
      ? t("Loading {name}…", { name: pretty(name) })
      : t("Save {name} as JSON", { name: pretty(name) });

  return (
    <button
      ref={ref}
      type="button"
      className="hset-anim-tile aria-disabled:cursor-wait aria-disabled:opacity-60"
      onClick={() => {
        if (disabled || loading) return;
        if (failed) setFailed(false);
        else if (data) onSave(path, name, data);
      }}
      aria-disabled={disabled || loading}
      aria-busy={pending || loading}
      aria-label={action}
      title={action}
    >
      <span className="hset-anim-stage">
        {data && inView ? (
          <LottiePlayer data={data} className="h-full w-full" autoplay={!reducedMotion} loop={!reducedMotion} />
        ) : (
          <span className="hset-anim-idle" aria-hidden />
        )}
        {data && (
          <span className="hset-icon-save" aria-hidden>
            {saved ? <Check size={14} strokeWidth={2.75} /> : <Download size={14} strokeWidth={2.25} />}
          </span>
        )}
      </span>
      <span className="hset-icon-name">{pretty(name)}</span>
      <span role="status" className={`min-h-[17px] text-[12px] leading-[17px] ${failed ? "text-danger" : "text-ink-subtle"}`}>
        {failed ? t("Load failed. Retry") : loading ? t("Loading…") : ""}
      </span>
    </button>
  );
}

function AnimationSet({ glob, download }: { glob: LazyGlob; download: AssetDownload }) {
  const keys = useMemo(() => Object.keys(glob).sort(), [glob]);
  const save = useCallback(
    (path: string, name: string, data: object) => {
      void download.save(path, `${name}.json`, async () => JSON.stringify(data), ["json"], "Lottie");
    },
    [download.save],
  );
  return (
    <>
      <div className="hset-anim-grid">
        {keys.map((k) => (
          <AnimationTile
            key={k}
            path={k}
            load={glob[k]}
            saved={download.savedId === k}
            pending={download.pendingId === k}
            disabled={download.pendingId !== null}
            onSave={save}
          />
        ))}
      </div>
      <AssetDownloadFeedback status={download.status && keys.includes(download.status.id) ? download.status : null} />
    </>
  );
}

const ABIYYU_LINKS = [
  { label: "Behance", url: "https://www.behance.net/gallery/251385405/Abiyyus-Portfolio-2026" },
  { label: "Fiverr", url: "https://pro.fiverr.com/freelancers/abiyyusw" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/abiyyu-suryowibisono-976838204" },
];

function AuthorCard({
  name,
  role,
  links,
  avatar,
}: {
  name: string;
  role: string;
  avatar: string;
  links: Array<{ label: string; url: string }>;
}) {
  const t = useT();
  return (
    <div className="hset-author">
      <div className="grid min-w-0 gap-1.5">
        <span className="hset-author-role">{t(role)}</span>
        <span className="hset-author-name">{name}</span>
        <span className="hset-author-links">
          {links.map((l) => (
            <button key={l.url} type="button" onClick={() => void openUrl(l.url)} className="hset-author-link">
              {l.label}
              <ArrowUpRight size={13} strokeWidth={2.25} aria-hidden />
            </button>
          ))}
        </span>
      </div>
      <img src={avatar} alt="" width={64} height={64} draggable={false} className="size-16 shrink-0 select-none rounded-full object-cover" />
    </div>
  );
}

export function IconsPanel() {
  const t = useT();
  const download = useAssetDownload();

  return (
    <>
      <Section
        title={t("Who drew our Art")}
      >
        <div className="hset-authors">
          <AuthorCard avatar={abiyyuAvatar} name="Abiyyu Suryowibisono" role="Icons, illustrations, and the cat" links={ABIYYU_LINKS} />
          <AuthorCard
            avatar={stassAvatar}
            name="stass_motion"
            role="Animation"
            links={[{ label: "Fiverr", url: "https://pro.fiverr.com/freelancers/stass_motion" }]}
          />
        </div>
      </Section>

      <Section
        title={t("Navigation")}
        subtitle={t("The sidebar set. Click any one to save the SVG.")}
      >
        <IconSet glob={NAV_URL} download={download} />
      </Section>

      <Section title={t("Interface")} subtitle={t("Buttons, states, and the things that live on a card.")}>
        <IconSet glob={UI_URL} download={download} />
      </Section>

      <Section
        title={t("Player")}
        subtitle={t("The chrome abiyyu drew for the player: transport, subtitles, shaders, and the rest.")}
      >
        <IconSet glob={PLAYER_URL} download={download} />
      </Section>

      <Section title={t("Navigation animations")} subtitle={t("What the sidebar icons do when you land on them.")}>
        <AnimationSet glob={LOTTIE_NAV} download={download} />
      </Section>

      <Section title={t("Everything else that moves")} subtitle={t("Loaders, boats, and the bits between screens.")}>
        <AnimationSet glob={LOTTIE_MAIN} download={download} />
      </Section>

      <Section
        title={t("Harbor and the installer")}
        subtitle={t("The Big Picture opener and the boat that builds itself while Harbor installs.")}
      >
        <AnimationSet glob={LOTTIE_APP} download={download} />
      </Section>

      <Section title={t("Using these")}>
        <p className={"max-w-[74ch] " + ROW_DESC}>
          {t(
            "These are Harbor's own, drawn for Harbor. Take them for a theme, a fork, a mockup, a personal project. Keep the credit on the artists and do not sell the set on its own.",
          )}
        </p>
        <p className="hset-attr-fineprint mt-3">
          {t(
            "The controller button glyphs elsewhere in Harbor are not ours. They come from Kenney's Input Prompts, released into the public domain under CC0.",
          )}
        </p>
      </Section>
    </>
  );
}
