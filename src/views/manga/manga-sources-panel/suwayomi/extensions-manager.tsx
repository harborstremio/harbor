import { AlertCircle, Blocks, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listExtensions,
  type ServerConfig,
  type SuwayomiExtension,
} from "@/lib/manga/sources/suwayomi/provider";
import { notifyMangaDataChanged } from "@/lib/manga/refresh";
import { languageName } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";
import { CARD, INPUT } from "../shared";
import { ExtensionRow } from "./extension-row";
import { ExtensionRepos } from "./extension-repos";

type Load = {
  key: string;
  state: "loading" | "ready" | "error";
  items: SuwayomiExtension[];
};

function matches(ext: SuwayomiExtension, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    ext.name.toLowerCase().includes(needle) || languageName(ext.lang).toLowerCase().includes(needle)
  );
}

function Group({
  label,
  count,
  config,
  items,
  onChanged,
}: {
  label: string;
  count: number;
  config: ServerConfig;
  items: SuwayomiExtension[];
  onChanged: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
        {label} · {count}
      </p>
      <div className={`divide-y divide-edge-soft overflow-hidden ${CARD}`}>
        {items.map((ext) => (
          <ExtensionRow key={ext.pkgName} config={config} ext={ext} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

export function ExtensionsManager({ config }: { config: ServerConfig }) {
  const t = useT();
  const [result, setResult] = useState<Load>({ key: "", state: "loading", items: [] });
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const baseUrl = config.baseUrl;
  const username = config.auth?.username;
  const password = config.auth?.password;
  const requestKey = JSON.stringify([baseUrl, username, password, reload]);
  const load =
    result.key === requestKey ? result : { ...result, key: requestKey, state: "loading" as const };

  useEffect(() => {
    let cancelled = false;
    const requestConfig: ServerConfig = {
      baseUrl,
      auth: username !== undefined && password !== undefined ? { username, password } : undefined,
    };
    listExtensions(requestConfig)
      .then((items) => {
        if (!cancelled) setResult({ key: requestKey, state: "ready", items });
      })
      .catch(() => {
        if (!cancelled) {
          setResult((previous) => ({
            key: requestKey,
            state: "error",
            items: previous.items,
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, username, password, requestKey]);

  const filtered = useMemo(
    () => load.items.filter((e) => matches(e, query.trim())),
    [load.items, query],
  );
  const installed = filtered.filter((e) => e.installed);
  const updatable = installed.filter((e) => e.hasUpdate);
  const available = filtered.filter((e) => !e.installed);
  const refresh = () => {
    notifyMangaDataChanged();
    setReload((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <ExtensionRepos config={config} onChanged={() => setReload((n) => n + 1)} />

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
          {t("Extensions")}
        </p>
        <button
          type="button"
          onClick={refresh}
          aria-label={t("Refresh extensions")}
          className="grid h-8 w-8 place-items-center rounded-lg bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-ink active:scale-95 motion-reduce:active:scale-100"
        >
          <RefreshCw size={15} className={load.state === "loading" ? "animate-spin" : ""} />
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
          placeholder={t("Search extensions")}
          autoCapitalize="off"
          spellCheck={false}
          className={`${INPUT} ps-11`}
        />
      </div>

      {load.state === "error" && load.items.length === 0 ? (
        <div className={`flex items-center justify-center gap-2 py-10 text-ink-muted ${CARD}`}>
          <AlertCircle size={16} className="text-danger" />
          <span className="text-[13.5px]">{t("Could not reach this server")}</span>
        </div>
      ) : load.state === "loading" && load.items.length === 0 ? (
        <div className={`flex items-center justify-center gap-2.5 py-10 text-ink-subtle ${CARD}`}>
          <Loader2 size={17} className="animate-spin" />
          <span className="text-[13.5px]">{t("Loading extensions...")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={`flex flex-col items-center gap-2 py-10 text-center text-ink-muted ${CARD}`}
        >
          <Blocks size={20} className="text-ink-subtle" />
          <span className="text-[13.5px]">
            {query ? t("No extensions match your search") : t("This server lists no extensions")}
          </span>
        </div>
      ) : (
        <>
          <Group
            label={t("Update available")}
            count={updatable.length}
            config={config}
            items={updatable}
            onChanged={() => setReload((n) => n + 1)}
          />
          <Group
            label={t("Installed")}
            count={installed.length}
            config={config}
            items={installed}
            onChanged={() => setReload((n) => n + 1)}
          />
          <Group
            label={t("Available")}
            count={available.length}
            config={config}
            items={available}
            onChanged={() => setReload((n) => n + 1)}
          />
        </>
      )}
    </div>
  );
}
