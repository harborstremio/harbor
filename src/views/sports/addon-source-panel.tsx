import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Play, Plug, RefreshCw, Search } from "lucide-react";
import { gatherCatalogAddons, type Addon } from "@/lib/addons";
import { isAddonEnabled } from "@/lib/addon-store";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import type { SportsGame } from "@/lib/sports/espn-types";
import {
  clearSportsAddonCatalogCache,
  refreshSportsAddonManifests,
  loadSportsAddonListings,
  loadSportsAddonStreams,
} from "@/lib/sports/addon-sources";
import { sportsAddonCatalogs, type SportsAddonListing } from "@/lib/sports/addon-sources-model";
import type { Stream } from "@/lib/streams/types";
import { parseStream } from "@/lib/streams/parser";
import { resolveStream } from "@/lib/streams/resolve";
import { registerStreamProxy, unregisterStreamProxy } from "@/lib/stream-proxy";
import { useSportsConsent } from "./access-gate";
import "./addon-source-panel.css";

type AddonSourcesProps = { game: SportsGame; onAvailable?: (available: boolean) => void };

export function SportsAddonSources({ game, onAvailable }: AddonSourcesProps) {
  const consent = useSportsConsent();
  return consent.status !== "accepted" || game.state === "post" ? null : (
    <AddonSources key={`${game.league}:${game.id}`} game={game} onAvailable={onAvailable} />
  );
}

function AddonMark({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <Plug size={20} aria-hidden="true" />
  );
}

function AddonSources({ game, onAvailable }: AddonSourcesProps) {
  const t = useT();
  const { authKey } = useAuth();
  const { activeId } = useProfiles();
  const { openPlayer, openPicker, setView } = useView();
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<SportsAddonListing[]>([]);
  useEffect(() => {
    onAvailable?.(rows.length > 0);
  }, [onAvailable, rows]);
  useEffect(
    () => () => {
      onAvailable?.(false);
    },
    [onAvailable],
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(24);
  const [picked, setPicked] = useState<SportsAddonListing | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [pending, setPending] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const run = useRef<AbortController | null>(null);
  const providers = useRef<Addon[]>([]);
  const trigger = useRef<string | null>(null);
  const listingButtons = useRef(new Map<string, HTMLButtonElement>());
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (picked) backButton.current?.focus({ preventScroll: true });
  }, [picked]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const identity = JSON.stringify([
    game.startMs,
    game.home.name,
    game.away.name,
    game.context?.name,
    game.broadcasts,
  ]);
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setPicked(null);
    setStreams([]);
    setLoading(true);
    setFailed(false);
    setInstalled(false);
    setPending(false);
    setPlaying(null);
    setError("");
    run.current?.abort();
    void (async () => {
      const gathered = await gatherCatalogAddons(authKey);
      if (controller.signal.aborted) return;
      const hydrated = await refreshSportsAddonManifests(gathered, controller.signal);
      if (controller.signal.aborted) return;
      const addons = hydrated.addons;
      providers.current = addons;
      const eligible = addons.filter((a) => sportsAddonCatalogs(a).length);
      setInstalled(eligible.length > 0);
      const result = await loadSportsAddonListings(
        eligible,
        gameRef.current,
        controller.signal,
        (rows) => {
          if (!controller.signal.aborted) setRows(rows);
        },
      );
      if (!controller.signal.aborted) {
        setRows(result.rows);
        setFailed(result.failed > 0 || hydrated.failed > 0);
      }
    })()
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      run.current?.abort();
    };
  }, [authKey, activeId, identity, refresh]);
  const matching = rows.filter((row) => row.match);
  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase().trim();
    return rows.filter(
      (row) =>
        (browse || row.match) &&
        (!needle ||
          `${row.meta.name} ${row.addon.manifest.name}`.toLocaleLowerCase().includes(needle)),
    );
  }, [rows, browse, search]);
  const choose = async (row: SportsAddonListing) => {
    if (!isAddonEnabled(row.addon.transportUrl)) {
      setRefresh((n) => n + 1);
      return;
    }
    trigger.current = row.key;
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setPicked(row);
    setStreams([]);
    setPending(true);
    setPlaying(null);
    setError("");
    try {
      const choices = await loadSportsAddonStreams(
        row,
        controller.signal,
        providers.current.filter((a) => isAddonEnabled(a.transportUrl)),
      );
      if (!controller.signal.aborted) setStreams(choices);
    } catch {
      if (!controller.signal.aborted) setError("Could not load this addon’s streams.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };
  const play = async (stream: Stream, index: number) => {
    if (
      !picked ||
      !isAddonEnabled(picked.addon.transportUrl) ||
      (stream.addonUrl && !isAddonEnabled(stream.addonUrl))
    ) {
      setRefresh((n) => n + 1);
      return;
    }
    if (!stream.url && (stream.externalUrl || stream.ytId)) {
      const url =
        stream.externalUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(stream.ytId!)}`;
      if (/^https?:\/\//i.test(url)) void openUrl(url);
      else setError("Could not start this stream. Choose another source.");
      return;
    }
    // Keep torrent/debrid consent and non-direct transports in Harbor's full picker.
    if (
      stream.infoHash ||
      !stream.url ||
      !/^https?:\/\//i.test(stream.url) ||
      (/^(movie|series)$/i.test(picked.meta.type) && picked.match !== "event")
    ) {
      openPicker(picked.meta, undefined, { autoPlay: false });
      return;
    }
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setPlaying(index);
    setError("");
    let proxySessionId: string | undefined;
    let transferred = false;
    try {
      const result = await resolveStream(
        parseStream(stream),
        [],
        controller.signal,
        true,
        false,
        undefined,
        false,
        false,
      );
      if (controller.signal.aborted) return;
      if (!result.ok) throw new Error("addon-source-resolution");
      let url = result.data.url;
      if (result.data.headers && Object.keys(result.data.headers).length) {
        const proxy = await registerStreamProxy(url, result.data.headers);
        url = proxy.url;
        proxySessionId = proxy.sessionId;
      }
      if (controller.signal.aborted) return;
      openPlayer({
        meta: picked.meta,
        url,
        title: picked.meta.name,
        subtitle: picked.addon.manifest.name,
        sportsDocked: true,
        isLive: true,
        notWebReady: result.data.notWebReady ?? true,
        subtitles: result.data.subtitles,
        historyUrl: result.data.url,
        proxySessionId,
      });
      transferred = true;
    } catch {
      if (!controller.signal.aborted)
        setError("Could not start this stream. Choose another source.");
    } finally {
      if (proxySessionId && !transferred)
        void unregisterStreamProxy(proxySessionId).catch(() => {});
      if (!controller.signal.aborted) setPlaying(null);
    }
  };
  if (!loading && !installed && !failed) return null;
  return (
    <section className="sh-addon-sources" aria-label={t("Addon sources")}>
      <header>
        <strong>
          <Plug size={17} aria-hidden="true" />
          {t("Addon sources")}
        </strong>
        <button
          type="button"
          className="sh-icon"
          aria-label={t("Refresh")}
          disabled={loading || pending || playing !== null}
          onClick={() => {
            clearSportsAddonCatalogCache();
            setRefresh((n) => n + 1);
          }}
        >
          <RefreshCw size={15} />
        </button>
      </header>
      {loading && (
        <p role="status">
          <Loader2 className="sh-addon-spinner" size={15} />
          {t("Matching installed addons…")}
        </p>
      )}
      {failed && <p role="status">{t("Some addons did not respond. Try again.")}</p>}
      {picked ? (
        <>
          <button
            ref={backButton}
            type="button"
            className="sh-text-button"
            onClick={() => {
              run.current?.abort();
              setPicked(null);
              setPlaying(null);
              setPending(false);
              setError("");
              requestAnimationFrame(() =>
                listingButtons.current.get(trigger.current || "")?.focus(),
              );
            }}
          >
            <ArrowLeft size={15} />
            {t("Back")}
          </button>
          <div className="sh-addon-picked">
            <AddonMark key={picked.addon.transportUrl} src={picked.addon.manifest.logo} />
            <span>
              <strong>{picked.addon.manifest.name}</strong>
              <small>{picked.meta.name}</small>
            </span>
          </div>
          {pending && (
            <p role="status">
              <Loader2 className="sh-addon-spinner" size={15} />
              {t("Checking addon streams…")}
            </p>
          )}
          {error && <p role="alert">{t(error)}</p>}
          {!pending && !streams.length && !error && (
            <p role="status">{t("No streams returned. The event may not be available yet.")}</p>
          )}
          <div className="sh-addon-choices">
            {streams.map((stream, index) => (
              <button
                type="button"
                key={index}
                disabled={playing !== null}
                onClick={() => void play(stream, index)}
              >
                {playing === index ? (
                  <Loader2 className="sh-addon-spinner" size={17} />
                ) : !stream.url && (stream.externalUrl || stream.ytId) ? (
                  <ExternalLink size={17} />
                ) : (
                  <Play size={17} />
                )}
                <span>
                  <strong>{stream.name || stream.addonName}</strong>
                  <small>
                    {stream.addonName}
                    {` · ${stream.title || stream.description || t("Play stream")}`}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {!loading && !matching.length && <p>{t("No matching addon listing yet.")}</p>}
          {rows.length > 0 && (
            <div className="sh-addon-tools">
              <button
                type="button"
                className="sh-button"
                aria-pressed={browse}
                onClick={() => {
                  setBrowse(!browse);
                  setLimit(24);
                  setSearch("");
                }}
              >
                {t(browse ? "Matching events" : "Browse addon channels")}
              </button>
              <label>
                <Search size={15} />
                <input
                  aria-label={t("Search addon channels")}
                  placeholder={t("Search addon channels")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setBrowse(true);
                    setLimit(24);
                  }}
                />
              </label>
            </div>
          )}
          <div className="sh-addon-choices">
            {filtered.slice(0, limit).map((row) => (
              <button
                type="button"
                key={row.key}
                ref={(node) => {
                  if (node) listingButtons.current.set(row.key, node);
                  else listingButtons.current.delete(row.key);
                }}
                onClick={() => void choose(row)}
              >
                <AddonMark src={row.addon.manifest.logo || row.meta.logo || row.meta.poster} />
                <span>
                  <strong>{row.meta.name}</strong>
                  <small>
                    {row.addon.manifest.name}
                    {row.match
                      ? ` · ${t(row.match === "event" ? "Event matchup found" : "Possible match · check the broadcast")}`
                      : ""}
                  </small>
                </span>
                <Play size={16} />
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <button type="button" className="sh-button" onClick={() => setLimit((n) => n + 24)}>
              {t("More addon channels")}
            </button>
          )}
          {filtered.length > 0 && <p>{t("Choose an addon source to see its streams.")}</p>}
        </>
      )}
      <button type="button" className="sh-text-button" onClick={() => setView("addons")}>
        {t("Addons")}
        <ExternalLink size={13} />
      </button>
    </section>
  );
}
