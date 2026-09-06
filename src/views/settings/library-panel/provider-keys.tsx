import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import fanartLogo from "@/assets/addon-logos/fanarttv.svg";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import omdbLogo from "@/assets/addon-logos/omdb.png";
import rpdbLogo from "@/assets/addon-logos/rpdb.png";
import auddLogo from "@/assets/addon-logos/auddio.webp";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useSettings } from "@/lib/settings";
import { tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { ExtLink, KeyField } from "../shared";
import { ModalButton, ROW_ACTION, SettingsModal } from "../kit";
import { TmdbGuideModal } from "../tmdb-tutorial-modal";
import { TvdbGuideModal } from "../tvdb-tutorial-modal";
import { ProviderKeyRow, type KeyEntry, type KeyId } from "./provider-key-row";
import { PosterServiceMark } from "./poster-mark";
import type { LibraryKey } from "../library-panel";
import nytLogo from "@/assets/service-logos/nyt.png";
import apiSportsLogo from "@/assets/service-logos/apisports.png";
import geminiLogo from "@/assets/ai-logos/gemini.png";

export type ProviderKeysArgs = {
  tmdbDraft: string;
  omdbDraft: string;
  rpdbDraft: string;
  fanartDraft: string;
  tvdbDraft: string;
  setTmdbDraft: (v: string) => void;
  setOmdbDraft: (v: string) => void;
  setRpdbDraft: (v: string) => void;
  setFanartDraft: (v: string) => void;
  setTvdbDraft: (v: string) => void;
  savedKey: string | null;
  saveKey: (which: LibraryKey, value: string) => void;
};

export function useProviderKeys({
  tmdbDraft,
  omdbDraft,
  rpdbDraft,
  fanartDraft,
  tvdbDraft,
  setTmdbDraft,
  setOmdbDraft,
  setRpdbDraft,
  setFanartDraft,
  setTvdbDraft,
  savedKey,
  saveKey,
}: ProviderKeysArgs) {
  const { settings, update } = useSettings();
  const t = useT();

  const [mdblistDraft, setMdblistDraft] = useState(settings.mdblistKey);
  const [nytDraft, setNytDraft] = useState(settings.nytKey);
  const [sportsDraft, setSportsDraft] = useState(settings.sportsApiKey);
  const [posterSrvDraft, setPosterSrvDraft] = useState(settings.posterBaseUrl);
  const [auddDraft, setAuddDraft] = useState(settings.auddKey);
  const [songAiDraft, setSongAiDraft] = useState(settings.songIdAiKey);
  const [extraSaved, setExtraSaved] = useState<
    "mdblist" | "postersrv" | "ai" | "audd" | "songai" | "nyt" | "sports" | null
  >(null);
  const [tmdbGuide, setTmdbGuide] = useState(false);
  const [tvdbGuide, setTvdbGuide] = useState(false);
  const [keyModal, setKeyModal] = useState<KeyId | null>(null);
  const keyFieldRef = useRef<HTMLDivElement | null>(null);
  const extraTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (extraTimerRef.current) window.clearTimeout(extraTimerRef.current);
  }, []);

  useEffect(() => {
    if (!keyModal) return;
    const field = keyFieldRef.current?.querySelector<HTMLInputElement>("input");
    if (field) tvFocus(field);
  }, [keyModal]);

  useEffect(() => {
    if (!keyModal && !tmdbGuide && !tvdbGuide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isBackKey(e)) return;
      if (tmdbGuide) setTmdbGuide(false);
      else if (tvdbGuide) setTvdbGuide(false);
      else setKeyModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyModal, tmdbGuide, tvdbGuide]);

  const flashExtra = (k: "mdblist" | "postersrv" | "ai" | "audd" | "songai" | "nyt" | "sports") => {
    setExtraSaved(k);
    if (extraTimerRef.current) window.clearTimeout(extraTimerRef.current);
    extraTimerRef.current = window.setTimeout(() => setExtraSaved(null), 1800);
  };

  const guideButton = (onClick: () => void, tip: string) => (
    <HoverTooltip side="top" align="center" label={tip}>
      <button type="button" onClick={onClick} className={ROW_ACTION}>
        <UiIcon name="help" className="h-[18px] w-[18px]" />
        {t("How to get this")}
      </button>
    </HoverTooltip>
  );

  const keyEntries: KeyEntry[] = [
    {
      id: "tmdb",
      name: t("TMDB"),
      desc: t("Trending, Popular, In Theaters, and the per service rails."),
      value: settings.tmdbKey,
      logo: tmdbLogo,
      badge: t("Recommended"),
      guide: guideButton(
        () => setTmdbGuide(true),
        t(
          "TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.",
        ),
      ),
      field: (
        <KeyField
          label={t("TMDB · catalogs and rails")}
          badge={t("Recommended")}
          placeholder={t("v3 API key")}
          value={tmdbDraft}
          onChange={setTmdbDraft}
          onSave={() => saveKey("tmdb", tmdbDraft)}
          saved={savedKey === "tmdb"}
          iconSrc={tmdbLogo}
          help={
            <>
              {t(
                "Highly recommended. This is what gives you the full Harbor experience: Popular, Trending, In Theaters, and per-service rails. Free at",
              )}{" "}
              <ExtLink href="https://www.themoviedb.org/settings/api">
                themoviedb.org/settings/api
              </ExtLink>
              . {t("Use the v3 key, not the read access token.")}
            </>
          }
        />
      ),
    },
    {
      id: "omdb",
      name: t("OMDb"),
      desc: t("Real IMDb and Rotten Tomatoes scores."),
      value: settings.omdbKey,
      logo: omdbLogo,
      field: (
        <KeyField
          label={t("OMDb · Rotten Tomatoes scores")}
          placeholder={t("8-character key")}
          value={omdbDraft}
          onChange={setOmdbDraft}
          onSave={() => saveKey("omdb", omdbDraft)}
          saved={savedKey === "omdb"}
          iconSrc={omdbLogo}
          help={
            <>
              {t("Free at")}{" "}
              <ExtLink href="https://www.omdbapi.com/apikey.aspx">omdbapi.com/apikey.aspx</ExtLink>.{" "}
              {t(
                "They email an activation link the first time. Click it, then come back and save.",
              )}
            </>
          }
        />
      ),
    },
    {
      id: "tvdb",
      name: t("TheTVDB"),
      desc: t("Episode titles, network info, and the alternate orderings."),
      value: settings.tvdbKey,
      logo: tvdbLogo,
      guide: guideButton(
        () => setTvdbGuide(true),
        t("The free tier is $0 for personal use. Just pick the first option, no payment needed."),
      ),
      field: (
        <KeyField
          label={t("TheTVDB · episode data")}
          placeholder={t("subscriber API key")}
          value={tvdbDraft}
          onChange={setTvdbDraft}
          onSave={() => saveKey("tvdb", tvdbDraft)}
          saved={savedKey === "tvdb"}
          iconSrc={tvdbLogo}
          help={
            <>
              {t(
                "Episode titles, alternate names, network info, and the arc/DVD/absolute orderings. Layered on TMDB so the better source wins per field. Free for personal use at",
              )}{" "}
              <ExtLink href="https://thetvdb.com/api-information">
                thetvdb.com/api-information
              </ExtLink>
              . {t('Choose the "Less than $50k per year" tier.')}
            </>
          }
        />
      ),
    },
    {
      id: "mdblist",
      name: t("MDBList"),
      desc: t("Letterboxd, Trakt, Metacritic, and audience scores."),
      value: settings.mdblistKey,
      logo: mdblistLogo,
      field: (
        <KeyField
          label={t("MDBList · Letterboxd and Trakt scores")}
          placeholder={t("mdblist api key")}
          value={mdblistDraft}
          onChange={setMdblistDraft}
          onSave={() => {
            update({ mdblistKey: mdblistDraft.trim() });
            flashExtra("mdblist");
          }}
          saved={extraSaved === "mdblist"}
          iconSrc={mdblistLogo}
          help={
            <>
              {t("Free key at")}{" "}
              <ExtLink href="https://mdblist.com/preferences/">mdblist.com</ExtLink>.{" "}
              {t(
                "Adds Letterboxd and Trakt community ratings to detail pages, covering what OMDb misses.",
              )}
            </>
          }
        />
      ),
    },
    {
      id: "fanart",
      name: t("Fanart.tv"),
      desc: t("Logos and backdrops where TMDB comes up empty."),
      value: settings.fanartKey,
      logo: fanartLogo,
      field: (
        <KeyField
          label={t("Fanart.tv · logos and backdrops")}
          placeholder={t("personal key")}
          value={fanartDraft}
          onChange={setFanartDraft}
          onSave={() => saveKey("fanart", fanartDraft)}
          saved={savedKey === "fanart"}
          iconSrc={fanartLogo}
          help={
            <>
              {t("Fills in where TMDB comes up empty (anime, older catalog). Free at")}{" "}
              <ExtLink href="https://fanart.tv/get-an-api-key/">fanart.tv/get-an-api-key</ExtLink>.{" "}
              {t('Use the "personal" key, not the project one.')}
            </>
          }
        />
      ),
    },
    {
      id: "rpdb",
      name: t("RPDB"),
      desc: t("Paid. Bakes scores into the poster image itself."),
      value: settings.rpdbKey,
      logo: rpdbLogo,
      field: (
        <KeyField
          label={t("RPDB · scores baked into posters")}
          placeholder={t("rpdb key")}
          value={rpdbDraft}
          onChange={setRpdbDraft}
          onSave={() => saveKey("rpdb", rpdbDraft)}
          saved={savedKey === "rpdb"}
          iconSrc={rpdbLogo}
          help={
            <>
              {t("Paid plan at")}{" "}
              <ExtLink href="https://ratingposterdb.com">ratingposterdb.com</ExtLink>.{" "}
              {t(
                "Once saved, every poster gets re-rendered with IMDb, Rotten Tomatoes, and Metacritic stamped on it.",
              )}
            </>
          }
        />
      ),
    },
    {
      id: "postersrv",
      name: t("Custom poster service"),
      desc: t("Swap in Better Posters, PostersPlus, or your own URL template."),
      value: settings.posterBaseUrl,
      mark: <PosterServiceMark size={20} />,
      field: (
        <KeyField
          label={t("Custom poster service")}
          placeholder={t("RPDB key above, https://btttr.cc, or a {imdbId} template")}
          value={posterSrvDraft}
          onChange={setPosterSrvDraft}
          onSave={() => {
            update({ posterBaseUrl: posterSrvDraft.trim() });
            flashExtra("postersrv");
          }}
          saved={extraSaved === "postersrv"}
          iconNode={<PosterServiceMark />}
          help={
            <>
              {t("Leave empty to use your RPDB key above. Or paste")}{" "}
              <strong>Better Posters</strong> (<code>https://btttr.cc</code>),{" "}
              {t(
                "a bare RPDB-compatible server (your RPDB key is still sent), or a full URL template using",
              )}{" "}
              <code>{"{imdbId}"}</code>, <code>{"{tmdbId}"}</code>, <code>{"{type}"}</code>,{" "}
              {t("or")} <code>{"{id}"}</code>. {t("PostersPlus needs the template form, e.g.")}{" "}
              <code>
                {"postersplus.elfhosted.com/poster?tmdb_id={tmdbId}&imdb_id={imdbId}&type={type}"}
              </code>
              .
            </>
          }
        />
      ),
    },
    {
      id: "nyt",
      name: t("New York Times"),
      desc: t("Bestseller lists in the eBook section."),
      value: settings.nytKey,
      field: (
        <KeyField
          label={t("New York Times · bestseller lists")}
          placeholder={t("NYT Books API key")}
          iconSrc={nytLogo}
          value={nytDraft}
          onChange={setNytDraft}
          onSave={() => {
            update({ nytKey: nytDraft.trim() });
            flashExtra("nyt");
          }}
          saved={extraSaved === "nyt"}
          help={
            <>
              {t(
                "Adds the New York Times bestseller lists to the eBook page, on the hero and as a row, with rank and weeks on the list. Free key at",
              )}{" "}
              <ExtLink href="https://developer.nytimes.com/get-started">
                developer.nytimes.com
              </ExtLink>
              . {t("Enable the Books API on your app. Lists refresh weekly.")}
            </>
          }
        />
      ),
    },
    {
      id: "sports",
      name: t("API-Sports"),
      desc: t("Egyptian, Qatari, Emirati and Korean football plus the KHL on the sports page."),
      value: settings.sportsApiKey,
      field: (
        <KeyField
          label={t("API-Sports · leagues ESPN does not carry")}
          placeholder={t("API-Sports key")}
          iconSrc={apiSportsLogo}
          value={sportsDraft}
          onChange={setSportsDraft}
          onSave={() => {
            update({ sportsApiKey: sportsDraft.trim() });
            flashExtra("sports");
          }}
          saved={extraSaved === "sports"}
          help={
            <>
              {t(
                "Fills the sports page where ESPN has no feed: Egyptian Premier League, Qatar Stars League, UAE Pro League, K League and the KHL, with lineups and live minutes. Free key at",
              )}{" "}
              <ExtLink href="https://dashboard.api-football.com/register">
                dashboard.api-football.com
              </ExtLink>
              .{" "}
              {t(
                "One account covers football and hockey. The free plan allows 100 requests a day and Harbor paces itself to stay inside it.",
              )}
            </>
          }
        />
      ),
    },
    {
      id: "songai",
      name: t("Gemini"),
      desc: t("Identify songs with Gemini on Windows. Your provider's usage limits apply."),
      value: settings.songIdAiKey,
      field: (
        <KeyField
          label={t("Gemini · in-player song ID")}
          iconSrc={geminiLogo}
          placeholder={t("Gemini API key")}
          value={songAiDraft}
          onChange={setSongAiDraft}
          onSave={() => {
            update({ songIdAiKey: songAiDraft.trim() });
            flashExtra("songai");
          }}
          saved={extraSaved === "songai"}
          help={
            <>
              {t("Identifies the song with Google Gemini. Get a key at")}{" "}
              <ExtLink href="https://aistudio.google.com/apikey">
                aistudio.google.com/apikey
              </ExtLink>
              . {t("Windows only.")}
            </>
          }
        />
      ),
    },
    {
      id: "audd",
      name: t("AudD"),
      desc: t("Powers the Identify song button in the player."),
      value: settings.auddKey,
      logo: auddLogo,
      field: (
        <KeyField
          label={t("AudD · in-player song ID")}
          placeholder={t("AudD API token")}
          value={auddDraft}
          onChange={setAuddDraft}
          onSave={() => {
            update({ auddKey: auddDraft.trim() });
            flashExtra("audd");
          }}
          saved={extraSaved === "audd"}
          iconSrc={auddLogo}
          help={
            <>
              {t("Powers the Identify-song button in the player. Get a token at")}{" "}
              <ExtLink href="https://dashboard.audd.io/">dashboard.audd.io</ExtLink>.
            </>
          }
        />
      ),
    },
  ];

  const entry = (id: KeyId) => keyEntries.find((e) => e.id === id) as KeyEntry;
  const openEntry = keyModal ? keyEntries.find((e) => e.id === keyModal) : undefined;
  const keyRow = (id: KeyId) => (
    <ProviderKeyRow key={id} entry={entry(id)} onOpen={() => setKeyModal(id)} />
  );

  const modals = (
    <>
      {openEntry && (
        <SettingsModal
          open
          onClose={() => setKeyModal(null)}
          title={openEntry.name}
          sub={openEntry.desc}
          actions={
            <>
              {openEntry.guide && <span className="me-auto flex">{openEntry.guide}</span>}
              <ModalButton onClick={() => setKeyModal(null)}>{t("Done")}</ModalButton>
            </>
          }
        >
          <div ref={keyFieldRef}>{openEntry.field}</div>
        </SettingsModal>
      )}
      <TmdbGuideModal open={tmdbGuide} onClose={() => setTmdbGuide(false)} />
      <TvdbGuideModal open={tvdbGuide} onClose={() => setTvdbGuide(false)} />
    </>
  );

  return { keyRow, modals };
}
