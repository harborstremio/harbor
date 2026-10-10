import { AlertCircle, ChevronRight, Compass, Loader2, RefreshCw } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useMemo, useState } from "react";
import {
  listSources,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";
import { languageName } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";
import { subscribeSuwayomiSourcesChanged } from "@/lib/manga/sources/suwayomi/source-events";
import { CARD, INPUT } from "../shared";
import { initials } from "./types";

function SourceIcon({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-edge-soft">
      {src && !failed ? (
        <img src={src} alt="" className="h-6 w-6 object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[12px] font-bold text-ink-muted">{initials(name)}</span>
      )}
    </span>
  );
}

export function SourcePicker({
  config,
  onPick,
}: {
  config: ServerConfig;
  onPick: (source: SuwayomiSource) => void;
}) {
  const t = useT();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [sources, setSources] = useState<SuwayomiSource[]>([]);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => subscribeSuwayomiSourcesChanged(() => setReload((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listSources(config)
      .then((list) => {
        if (cancelled) return;
        setSources(list);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [config.baseUrl, config.auth?.username, config.auth?.password, reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (s) => s.name.toLowerCase().includes(q) || languageName(s.lang).toLowerCase().includes(q),
    );
  }, [sources, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
          {t("Browse sources")}
        </p>
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          aria-label={t("Refresh sources")}
          className="grid h-8 w-8 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95 motion-reduce:active:scale-100"
        >
          <RefreshCw size={15} className={state === "loading" ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Filter sources")}
          autoCapitalize="off"
          spellCheck={false}
          className={`${INPUT} ps-11`}
        />
      </div>

      {state === "loading" && sources.length === 0 ? (
        <div className={`flex items-center justify-center gap-2.5 py-10 text-ink-subtle ${CARD}`}>
          <Loader2 size={17} className="animate-spin" />
          <span className="text-[13.5px]">{t("Loading sources...")}</span>
        </div>
      ) : state === "error" ? (
        <div className={`flex items-center justify-center gap-2 py-10 text-ink-muted ${CARD}`}>
          <AlertCircle size={16} className="text-danger" />
          <span className="text-[13.5px]">{t("Could not load sources")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={`flex flex-col items-center gap-2 py-10 text-center text-ink-muted ${CARD}`}
        >
          <Compass size={20} className="text-ink-subtle" />
          <span className="text-[13.5px]">
            {query
              ? t("No sources match your filter")
              : t("Install an extension above to get sources")}
          </span>
        </div>
      ) : (
        <div className={`divide-y divide-edge-soft overflow-hidden ${CARD}`}>
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s)}
              className="flex w-full items-center gap-3.5 px-5 py-3.5 text-start transition-colors hover:bg-raised/50 active:scale-[0.99] motion-reduce:active:scale-100"
            >
              <SourceIcon src={s.iconUrl} name={s.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-ink">{s.name}</span>
                  {s.isNsfw && (
                    <span className="shrink-0 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-bold text-danger">
                      18+
                    </span>
                  )}
                </div>
                <span className="truncate text-[12.5px] text-ink-muted">
                  {languageName(s.lang)}
                </span>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink-subtle" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
