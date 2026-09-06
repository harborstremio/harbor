import { useCallback, useState, type CSSProperties } from "react";
import { ArrowUpRight, Check, Download } from "./icons";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/build-info";
import { downloadText } from "@/lib/download-text";
import { Section } from "./shared";
import { ROW_DESC } from "./kit";
import harborWordmark from "@/assets/harbor-wordmark.svg";
import crowdinLogo from "@/assets/crowdin-mark.png";
import cloudsmithLogo from "@/assets/cloudsmith.png";
import elfhostedLogo from "@/assets/elfhosted.svg";
import stremioAddonsLogo from "@/assets/stremio-addons-net.png";
import stremioLogo from "@/assets/stremio.png";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import fanartLogo from "@/assets/addon-logos/fanarttv.svg";
import kitsuLogo from "@/assets/addon-logos/anime-kitsu.png";
import omdbLogo from "@/assets/addon-logos/omdb.png";
import rpdbLogo from "@/assets/addon-logos/rpdb.png";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import imdbLogo from "@/assets/service-logos/imdb.png";
import rtLogo from "@/assets/service-logos/rottentomatoes.png";
import metacriticLogo from "@/assets/service-logos/metacritic.png";
import opensubtitlesLogo from "@/assets/opensubtitles.png";
import subdlLogo from "@/assets/service-logos/subdl.png";
import subsourceLogo from "@/assets/service-logos/subsource.png";
import wyzieLogo from "@/assets/wyzie.png";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
import anilistLogo from "@/assets/anilist.png";
import malLogo from "@/assets/mal.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import aniskipLogo from "@/assets/service-logos/aniskip.png";
import introdbLogo from "@/assets/service-logos/theintrodb.png";
import realdebridLogo from "@/assets/addon-logos/realdebrid.png";
import premiumizeLogo from "@/assets/addon-logos/premiumize.png";
import alldebridLogo from "@/assets/addon-logos/alldebrid.webp";
import torboxLogo from "@/assets/addon-logos/torbox.png";
import debridlinkLogo from "@/assets/addon-logos/debridlink.png";
import plexLogo from "@/assets/service-logos/plex.png";
import jellyfinLogo from "@/assets/service-logos/jellyfin.png";
import embyLogo from "@/assets/service-logos/emby.png";
import rokuLogo from "@/assets/service-logos/roku.png";
import chromecastMark from "@/assets/service-logos/chromecast.svg";
import airplayMark from "@/assets/service-logos/airplayvideo.svg";
import dlnaMark from "@/assets/service-logos/dlna.svg";
import easynewsLogo from "@/assets/addon-logos/easynews.png";
import aiostreamsLogo from "@/assets/addon-logos/aiostreams.png";
import localFilesLogo from "@/assets/addon-logos/local-files.png";
import mangaupdatesLogo from "@/assets/mangaupdates.png";
import suwayomiLogo from "@/assets/service-logos/suwayomi.png";
import mangayomiLogo from "@/assets/service-logos/mangayomi.png";
import openrouterLogo from "@/assets/ai-logos/openrouter.png";
import groqLogo from "@/assets/ai-logos/groq.png";
import geminiLogo from "@/assets/ai-logos/gemini.png";
import jinaLogo from "@/assets/ai-logos/jina.png";
import auddLogo from "@/assets/addon-logos/auddio.webp";
import discordLogo from "@/assets/service-logos/discord.png";
import telegramLogo from "@/assets/service-logos/telegram.png";
import nytLogo from "@/assets/service-logos/nyt.png";
import apiSportsLogo from "@/assets/service-logos/apisports.png";
import cloudflareLogo from "@/assets/cloudflare.png";
import svpLogo from "@/assets/service-logos/svp.png";
import tauriLogo from "@/assets/oss-logos/tauri.png";
import reactLogo from "@/assets/oss-logos/react.png";
import ffmpegLogo from "@/assets/oss-logos/ffmpeg.png";
import lucideLogo from "@/assets/oss-logos/lucide.png";
import rustLogo from "@/assets/oss-logos/rust.png";
import mpvLogo from "@/assets/oss-logos/mpv.png";

const LICENSE_TEXT = import.meta.glob("../../assets/licenses/*.txt", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<unknown>>;

type Credit = { name: string; blurb: string; url: string; logo?: string; fill?: boolean; mono?: string };
type Dep = { name: string; license: string; url: string; logo: string };
type LicenseDoc = { id: string; title: string; used: string; file: string };

function Logo({
  src,
  mono,
  name,
  size,
  fill,
}: {
  src?: string;
  mono?: string;
  name: string;
  size: number;
  fill?: boolean;
}) {
  return (
    <span
      className="hset-logo"
      data-fill={fill ? "" : undefined}
      style={{ "--hset-logo-size": size + "px" } as CSSProperties}
    >
      {mono ? (
        <span
          aria-hidden
          className="hset-logo-mono"
          style={{ maskImage: `url("${mono}")`, WebkitMaskImage: `url("${mono}")` }}
        />
      ) : src ? (
        <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
      ) : (
        <span className="hset-logo-initial">{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

function BrandCard({ credit }: { credit: Credit }) {
  const t = useT();
  return (
    <button type="button" onClick={() => void openUrl(credit.url)} className="hset-brandcard" title={credit.url}>
      <Logo src={credit.logo} name={credit.name} size={54} fill={credit.fill} />
      <span className="hset-brandcard-name">
        <span className="min-w-0 truncate">{credit.name}</span>
        <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden />
      </span>
      <span className="hset-brandcard-blurb">{t(credit.blurb)}</span>
    </button>
  );
}

function ServiceRow({ credit }: { credit: Credit }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => void openUrl(credit.url)}
      className="hset-row group text-start"
      data-interactive=""
      title={credit.url}
    >
      <span className="hset-row-text">
        <Logo src={credit.logo} mono={credit.mono} name={credit.name} size={38} fill={credit.fill} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[16.5px] font-medium leading-[22px] tracking-[-0.12px] text-ink">{credit.name}</span>
          <span className={"max-w-[70ch] " + ROW_DESC}>{t(credit.blurb)}</span>
        </span>
      </span>
      <span className="hset-row-control">
        <ArrowUpRight
          size={17}
          strokeWidth={2}
          aria-hidden
          className="dir-icon shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
        />
      </span>
    </button>
  );
}

function DepRow({ dep }: { dep: Dep }) {
  return (
    <button type="button" onClick={() => void openUrl(dep.url)} className="hset-ossrow" title={dep.url}>
      <Logo src={dep.logo} name={dep.name} size={30} />
      <span className="hset-ossname">{dep.name}</span>
      <span className="hset-osslicense">{dep.license}</span>
    </button>
  );
}

function Group({ title, subtitle, items }: { title: string; subtitle: string; items: Credit[] }) {
  const t = useT();
  return (
    <Section title={t(title)} subtitle={t(subtitle)}>
      {items.map((c) => (
        <ServiceRow key={c.name} credit={c} />
      ))}
    </Section>
  );
}

function LicenseRow({
  doc,
  saved,
  onSave,
}: {
  doc: LicenseDoc;
  saved: boolean;
  onSave: (doc: LicenseDoc) => void;
}) {
  const t = useT();
  return (
    <button type="button" onClick={() => onSave(doc)} className="hset-row text-start" data-interactive="">
      <span className="hset-row-text">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[16.5px] font-medium leading-[22px] tracking-[-0.12px] text-ink">{doc.title}</span>
          <span className={"max-w-[70ch] " + ROW_DESC}>{t(doc.used)}</span>
        </span>
      </span>
      <span className="hset-row-control">
        <span className="hset-license-save">
          {saved ? <Check size={16} strokeWidth={2.5} aria-hidden /> : <Download size={16} strokeWidth={2} aria-hidden />}
          {saved ? t("Saved") : t("Save")}
        </span>
      </span>
    </button>
  );
}

const PARTNERS: Credit[] = [
  {
    name: "Crowdin",
    blurb: "Provides the localisation platform Harbor is translated on, free of charge.",
    url: "https://crowdin.com",
    logo: crowdinLogo,
    fill: true,
  },
  {
    name: "Cloudsmith",
    blurb: "Hosts Harbor's apt and rpm package repositories, free of charge.",
    url: "https://cloudsmith.com",
    logo: cloudsmithLogo,
    fill: true,
  },
  {
    name: "ElfHosted",
    blurb: "Runs Harbor's community addon infrastructure and the hosted build.",
    url: "https://elfhosted.com",
    logo: elfhostedLogo,
  },
  {
    name: "stremio-addons.net",
    blurb: "Provides the community addon directory used by Harbor's Addons page.",
    url: "https://stremio-addons.net",
    logo: stremioAddonsLogo,
    fill: true,
  },
];

const METADATA: Credit[] = [
  {
    name: "The Movie Database",
    blurb:
      "Film and television metadata, artwork, cast and recommendations. This product uses the TMDB API but is not endorsed or certified by TMDB.",
    url: "https://www.themoviedb.org",
    logo: tmdbLogo,
  },
  { name: "TheTVDB", blurb: "Episode ordering, air dates and series artwork.", url: "https://thetvdb.com", logo: tvdbLogo },
  {
    name: "Fanart.tv",
    blurb: "Community-contributed logos, backdrops and clear art used on hero and detail pages.",
    url: "https://fanart.tv",
    logo: fanartLogo,
  },
  { name: "Kitsu", blurb: "Anime metadata and identifier mapping between anime databases.", url: "https://kitsu.io", logo: kitsuLogo },
  { name: "AniZip", blurb: "Anime episode mapping across Kitsu, AniList, MyAnimeList and TheTVDB.", url: "https://ani.zip" },
  { name: "OMDb", blurb: "Supplementary ratings, including Rotten Tomatoes scores.", url: "https://www.omdbapi.com", logo: omdbLogo },
  { name: "RPDB", blurb: "Ratings rendered directly into poster images.", url: "https://ratingposterdb.com", logo: rpdbLogo },
  { name: "MDBList", blurb: "Aggregated ratings and user-maintained lists.", url: "https://mdblist.com", logo: mdblistLogo },
  { name: "IMDb", blurb: "Title identifiers and ratings, retrieved through the providers above.", url: "https://www.imdb.com", logo: imdbLogo },
  { name: "Rotten Tomatoes", blurb: "Critic and audience scores shown on detail pages.", url: "https://www.rottentomatoes.com", logo: rtLogo },
  { name: "Metacritic", blurb: "Metascores shown on detail pages.", url: "https://www.metacritic.com", logo: metacriticLogo },
  { name: "The New York Times", blurb: "Bestseller lists shown in the eBook section.", url: "https://developer.nytimes.com", logo: nytLogo },
  { name: "API-Sports", blurb: "Fixtures and results for leagues not covered by the default sports provider.", url: "https://api-sports.io", logo: apiSportsLogo },
];

const TRACKERS: Credit[] = [
  { name: "Trakt", blurb: "Account sign-in, watched history, scrobbling, watchlists and comments.", url: "https://trakt.tv", logo: traktLogo },
  { name: "Simkl", blurb: "Account sign-in, watch history and scrobbling, including anime.", url: "https://simkl.com", logo: simklLogo },
  { name: "AniList", blurb: "Anime and manga list management and progress synchronisation.", url: "https://anilist.co", logo: anilistLogo },
  { name: "MyAnimeList", blurb: "Anime and manga list management and progress synchronisation.", url: "https://myanimelist.net", logo: malLogo },
  { name: "Letterboxd", blurb: "Film diary and watchlist import.", url: "https://letterboxd.com", logo: letterboxdLogo },
];

const SUBTITLES: Credit[] = [
  { name: "OpenSubtitles", blurb: "Subtitle search and download.", url: "https://www.opensubtitles.com", logo: opensubtitlesLogo },
  { name: "SUBDL", blurb: "Subtitle search and download.", url: "https://subdl.com", logo: subdlLogo },
  { name: "Subsource", blurb: "Subtitle search and download.", url: "https://subsource.net", logo: subsourceLogo },
  { name: "Wyzie", blurb: "Subtitle search requiring no API key.", url: "https://wyzie.ru", logo: wyzieLogo },
];

const SKIPPING: Credit[] = [
  { name: "AniSkip", blurb: "Community-contributed opening and ending timings for anime.", url: "https://aniskip.com", logo: aniskipLogo },
  { name: "TheIntroDB", blurb: "Intro and credits timings for films and television.", url: "https://theintrodb.org", logo: introdbLogo },
];

const DEBRID: Credit[] = [
  { name: "Real-Debrid", blurb: "Cached torrent resolution and direct download links.", url: "https://real-debrid.com", logo: realdebridLogo },
  { name: "Premiumize", blurb: "Cached torrent resolution and cloud library access.", url: "https://www.premiumize.me", logo: premiumizeLogo },
  { name: "AllDebrid", blurb: "Cached torrent resolution and direct download links.", url: "https://alldebrid.com", logo: alldebridLogo },
  { name: "TorBox", blurb: "Cached torrent resolution and cloud library access.", url: "https://torbox.app", logo: torboxLogo },
  { name: "Debrid-Link", blurb: "Cached torrent resolution and direct download links.", url: "https://debrid-link.com", logo: debridlinkLogo },
];

const SERVERS: Credit[] = [
  { name: "Plex", blurb: "Playback from a Plex Media Server library.", url: "https://www.plex.tv", logo: plexLogo },
  { name: "Jellyfin", blurb: "Playback from a Jellyfin server library.", url: "https://jellyfin.org", logo: jellyfinLogo },
  { name: "Emby", blurb: "Playback from an Emby server library.", url: "https://emby.media", logo: embyLogo },
];

const CASTING: Credit[] = [
  { name: "Google Cast", blurb: "Casting to Chromecast and Google Cast receivers.", url: "https://www.google.com/chromecast", mono: chromecastMark },
  { name: "Roku", blurb: "Casting to Roku devices.", url: "https://www.roku.com", logo: rokuLogo },
  { name: "AirPlay", blurb: "Casting to Apple TV and AirPlay receivers.", url: "https://www.apple.com/airplay", mono: airplayMark },
  { name: "DLNA", blurb: "Casting to DLNA and UPnP renderers on the local network.", url: "https://www.dlna.org", mono: dlnaMark },
];

const ADDONS: Credit[] = [
  {
    name: "Stremio",
    blurb: "The open addon protocol Harbor implements. Harbor is an independent client for that protocol.",
    url: "https://www.stremio.com",
    logo: stremioLogo,
  },
  { name: "Easynews", blurb: "Usenet search and playback.", url: "https://www.easynews.com", logo: easynewsLogo },
  { name: "AIOStreams", blurb: "Aggregates multiple stream sources into a single addon.", url: "https://github.com/Viren070/AIOStreams", logo: aiostreamsLogo },
  { name: "Local Files", blurb: "Playback of media already stored on the device.", url: "https://www.stremio.com", logo: localFilesLogo },
];

const MANGA: Credit[] = [
  { name: "MangaUpdates", blurb: "Series metadata, chapter counts and release tracking.", url: "https://www.mangaupdates.com", logo: mangaupdatesLogo },
  { name: "Suwayomi", blurb: "The manga source server Harbor connects to.", url: "https://github.com/Suwayomi", logo: suwayomiLogo },
  { name: "Mangayomi", blurb: "Source extensions Harbor can read.", url: "https://github.com/kodjodevf/mangayomi", logo: mangayomiLogo },
];

const AI: Credit[] = [
  { name: "OpenRouter", blurb: "Model routing for natural-language search.", url: "https://openrouter.ai", logo: openrouterLogo },
  { name: "Groq", blurb: "Low-latency inference for natural-language search.", url: "https://groq.com", logo: groqLogo },
  { name: "Google Gemini", blurb: "Track identification during playback.", url: "https://ai.google.dev", logo: geminiLogo },
  { name: "AudD", blurb: "Track identification during playback.", url: "https://audd.io", logo: auddLogo },
  { name: "Jina", blurb: "Page retrieval for search results.", url: "https://jina.ai", logo: jinaLogo },
];

const NOTIFY: Credit[] = [
  { name: "Discord", blurb: "Webhook notifications and Rich Presence.", url: "https://discord.com", logo: discordLogo },
  { name: "Telegram", blurb: "Webhook notifications.", url: "https://telegram.org", logo: telegramLogo },
  { name: "Cloudflare", blurb: "Edge delivery for the services Harbor connects to.", url: "https://www.cloudflare.com", logo: cloudflareLogo },
];

const DEPS: Dep[] = [
  { name: "Tauri", license: "MIT / Apache-2.0", url: "https://tauri.app", logo: tauriLogo },
  { name: "mpv", license: "GPL-2.0-or-later / LGPL-2.1-or-later", url: "https://mpv.io", logo: mpvLogo },
  { name: "FFmpeg", license: "LGPL-2.1-or-later / GPL-2.0-or-later", url: "https://ffmpeg.org", logo: ffmpegLogo },
  { name: "SVP", license: "Proprietary, optional", url: "https://www.svp-team.com", logo: svpLogo },
  { name: "React", license: "MIT", url: "https://react.dev", logo: reactLogo },
  { name: "librqbit", license: "Apache-2.0", url: "https://github.com/ikatson/rqbit", logo: rustLogo },
  { name: "Lucide", license: "ISC", url: "https://lucide.dev", logo: lucideLogo },
];

const LICENSES: LicenseDoc[] = [
  { id: "harbor", title: "Harbor, MIT License", used: "The licence Harbor itself is released under.", file: "Harbor" },
  { id: "mit", title: "MIT License", used: "Used by the majority of Harbor's bundled components, including React and Tauri.", file: "MIT" },
  { id: "apache", title: "Apache License 2.0", used: "Used by Tauri, librqbit and other bundled components.", file: "Apache-2.0" },
  { id: "gpl2", title: "GNU General Public License v2.0", used: "Applies to mpv, and to FFmpeg builds configured with GPL components.", file: "GPL-2.0-or-later" },
  { id: "lgpl21", title: "GNU Lesser General Public License v2.1", used: "Applies to FFmpeg and to mpv's LGPL configuration.", file: "LGPL-2.1-or-later" },
  { id: "bsd3", title: "BSD 3-Clause License", used: "Used by several bundled components.", file: "BSD-3-Clause" },
  { id: "bsd2", title: "BSD 2-Clause License", used: "Used by several bundled components.", file: "BSD-2-Clause" },
  { id: "isc", title: "ISC License", used: "Used by Lucide and several bundled components.", file: "ISC" },
  {
    id: "notices",
    title: "Third-party notices",
    used: "The full list of bundled components, their versions and their licences.",
    file: "third-party",
  },
];

export function LicensesPanel() {
  const t = useT();
  const [savedId, setSavedId] = useState<string | null>(null);

  const save = useCallback(async (doc: LicenseDoc) => {
    const load = LICENSE_TEXT[`../../assets/licenses/${doc.file}.txt`];
    if (!load) return;
    const text = (await load()) as string;
    const ok = await downloadText(`${doc.file}.txt`, text, ["txt"], "Licence");
    if (!ok) return;
    setSavedId(doc.id);
    window.setTimeout(() => setSavedId((cur) => (cur === doc.id ? null : cur)), 1600);
  }, []);

  return (
    <>
      <div className="hset-attr-hero">
        <span className="hset-attr-wordmark">
          <img src={harborWordmark} alt="Harbor" draggable={false} />
          <span className="hset-attr-version">{APP_VERSION}</span>
        </span>
        <p className="hset-attr-license">
          {t("Harbor is free and open source software, released under the MIT License.")}
        </p>
      </div>

      <Section
        title={t("Acknowledgements")}
        subtitle={t("These organisations provide their services to Harbor at no cost.")}
      >
        <div className="hset-brandgrid">
          {PARTNERS.map((c) => (
            <BrandCard key={c.name} credit={c} />
          ))}
        </div>
      </Section>

      <Group title="Metadata and artwork" subtitle="Sources of the information and imagery shown in Harbor." items={METADATA} />
      <Group
        title="Trackers and lists"
        subtitle="Services that can record viewing activity. Harbor is not affiliated with any of them."
        items={TRACKERS}
      />
      <Group title="Subtitles" subtitle="Providers queried when searching for subtitles." items={SUBTITLES} />
      <Group title="Intro and credits skipping" subtitle="Sources of chapter and segment timing data." items={SKIPPING} />
      <Group title="Debrid" subtitle="Services Harbor can resolve streams through." items={DEBRID} />
      <Group title="Media servers" subtitle="Personal media servers Harbor can play from." items={SERVERS} />
      <Group title="Casting" subtitle="Protocols and devices Harbor can cast to." items={CASTING} />
      <Group title="Addons and usenet" subtitle="Sources of the streams themselves." items={ADDONS} />
      <Group title="Manga" subtitle="Manga sources, readers and tracking services." items={MANGA} />
      <Group title="AI and track identification" subtitle="Providers behind natural-language search and song identification." items={AI} />
      <Group title="Notifications and delivery" subtitle="Services used to deliver notifications and content." items={NOTIFY} />

      <Section title={t("Built on")} subtitle={t("The principal open source components Harbor is built from.")}>
        <div className="hset-osslist">
          {DEPS.map((d) => (
            <DepRow key={d.name} dep={d} />
          ))}
        </div>
      </Section>

      <Section
        title={t("Licence texts")}
        subtitle={t(
          "The full text of every licence covering software distributed with Harbor. Select any entry to save a copy.",
        )}
      >
        {LICENSES.map((doc) => (
          <LicenseRow key={doc.id} doc={doc} saved={savedId === doc.id} onSave={save} />
        ))}
      </Section>

      <Section title={t("Independence")}>
        <p className={"max-w-[74ch] " + ROW_DESC}>
          {t(
            "Harbor is an independent client. It is not affiliated with, endorsed by, or sponsored by Stremio, or by any company, addon author, or trademark holder referenced in this application. All trademarks are the property of their respective owners.",
          )}
        </p>
        <p className="hset-attr-fineprint mt-3">
          {t(
            "Harbor hosts no media and indexes no media. The sources and addons available to you are the ones you choose to configure, and their use is subject to the laws of your jurisdiction and the terms of the services concerned.",
          )}
        </p>
      </Section>
    </>
  );
}
