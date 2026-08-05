import { AlertCircle, Blocks, ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listExtensions,
  type ServerConfig,
  type SuwayomiExtension,
} from "@/lib/manga/sources/suwayomi/provider";
import { languageName } from "@/lib/manga/types";
import { useT } from "@/lib/i18n";
import { CARD, INPUT } from "../shared";
import { ExtensionRow } from "./extension-row";
import { ExtensionRepos } from "./extension-repos";

type Load = { state: "loading" | "ready" | "error"; items: SuwayomiExtension[] };

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
  collapsible = false,
  expanded = true,
  onExpandedChange,
  contentId,
}: {
  label: string;
  count: number;
  config: ServerConfig;
  items: SuwayomiExtension[];
  onChanged: () => void;
  collapsible?: boolean;
  expanded?: boolean;
  onExpandedChange?: () => void;
  contentId?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onExpandedChange}
          className="group flex min-h-10 w-full items-center justify-between rounded-xl px-2 text-start text-ink-subtle transition-colors hover:bg-raised/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.12em]">
            {label} · {count}
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised/70 ring-1 ring-edge-soft transition-colors group-hover:bg-elevated">
            <ChevronDown
              aria-hidden="true"
              size={16}
              className={`transition-transform duration-150 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      ) : (
        <p className="px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
          {label} · {count}
        </p>
      )}
      <div
        id={contentId}
        hidden={collapsible && !expanded}
        className={`divide-y divide-edge-soft overflow-hidden ${CARD}`}
      >
        {(!collapsible || expanded) &&
          items.map((ext) => (
            <ExtensionRow key={ext.pkgName} config={config} ext={ext} onChanged={onChanged} />
          ))}
      </div>
    </div>
  );
}

export function ExtensionsManager({ config }: { config: ServerConfig }) {
  const t = useT();
  const [load, setLoad] = useState<Load>({ state: "loading", items: [] });
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [availableExpanded, setAvailableExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad((prev) => ({ state: "loading", items: prev.items }));
    listExtensions(config)
      .then((items) => {
        if (!cancelled) setLoad({ state: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setLoad((prev) => ({ state: "error", items: prev.items }));
      });
    return () => {
      cancelled = true;
    };
  }, [config.baseUrl, config.auth?.username, config.auth?.password, reload]);

  const filtered = useMemo(
    () => load.items.filter((e) => matches(e, query.trim())),
    [load.items, query],
  );
  const installed = filtered.filter((e) => e.installed);
  const updatable = installed.filter((e) => e.hasUpdate);
  const available = filtered.filter((e) => !e.installed);

  return (
    <div className="flex flex-col gap-3">
      <ExtensionRepos config={config} onChanged={() => setReload((n) => n + 1)} />

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
          {t("Extensions")}
        </p>
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
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
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setAvailableExpanded(true);
          }}
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
            collapsible
            expanded={availableExpanded}
            onExpandedChange={() => setAvailableExpanded((open) => !open)}
            contentId="suwayomi-available-extensions"
          />
        </>
      )}
    </div>
  );
}
