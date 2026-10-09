import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Play, Search } from "lucide-react";
import { SFX } from "@/lib/sfx";
import type { SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { useBpT } from "../bp-i18n";
import { BpKeyboard } from "../bp-keyboard";
import { setBpFocus } from "../use-bp-focus";
import {
  BP_ADDON_CELL,
  BP_ADDON_CHIP,
  BP_ADDON_FLUSH,
  BP_ADDON_LIFT,
  BP_ADDON_NOTE,
  BP_ADDON_SUB,
  BP_ADDON_TITLE,
  BpSportsAddonMark,
} from "./bp-sports-addon-parts";
import type { BpSportsAddonSources } from "./bp-sports-addon-sources";

const PAGE = 24;

const LIST =
  "-mx-[16px] flex max-h-[36vh] flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const field = (lit: boolean) =>
  `flex h-[clamp(48px,6vh,70px)] min-w-0 flex-1 items-center gap-[clamp(9px,0.8vw,16px)] rounded-[var(--bp-r-md)] border bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] ${lit ? "border-[var(--bp-focus-stroke)]" : "border-[var(--bp-edge-2)]"}`;

const INPUT =
  "min-w-0 flex-1 bg-transparent text-[calc(clamp(17px,2.4vh,31px)*var(--bp-up,1))] font-semibold text-ink outline-none placeholder:text-ink-subtle";

export function BpSportsAddonListings({
  sources,
  onChoose,
  onClose,
  seedRef,
}: {
  sources: BpSportsAddonSources;
  onChoose: (row: SportsAddonListing) => void;
  onClose: () => void;
  seedRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useBpT();
  const [browse, setBrowse] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [lit, setLit] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const { rows, matching, loading } = sources;
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLButtonElement | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const el = typing ? fieldRef.current : searchRef.current;
      if (el) setBpFocus(el, { silent: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [typing]);

  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    return rows.filter(
      (row) =>
        (browse || row.match !== null) &&
        (needle === "" ||
          `${row.meta.name} ${row.addon.manifest.name}`.toLocaleLowerCase().includes(needle)),
    );
  }, [rows, browse, query]);

  const shown = filtered.slice(0, limit);
  const more = filtered.length - shown.length;

  const note = loading
    ? t("Matching installed addons…")
    : !sources.installed
      ? t("No installed addon offers a sports catalog yet.")
      : matching.length === 0 && !browse && query === ""
        ? t("No matching addon listing yet. Browse every addon channel to look for the broadcast.")
        : filtered.length === 0
          ? t("No addon listing matches that name.")
          : t("Choose an addon source to see its streams.");

  return (
    <>
      {typing && (
        <div data-bp-row style={BP_ADDON_FLUSH}>
          <div data-bp-scroll-x className="flex items-center gap-[clamp(9px,0.9vw,16px)]">
            <span className={field(lit)}>
              <Search size={20} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
              <input
                ref={fieldRef}
                data-bp-focusable
                data-tv-text-auto
                value={query}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                onFocus={() => setLit(true)}
                onBlur={() => setLit(false)}
                aria-label={t("Search addon channels")}
                placeholder={t("Channel or event name")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setBrowse(true);
                  setLimit(PAGE);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
                className={INPUT}
              />
            </span>
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.close();
                setTyping(false);
              }}
              className={BP_ADDON_CHIP}
            >
              {t("Done")}
            </button>
          </div>
        </div>
      )}

      <p role="status" className={BP_ADDON_NOTE}>
        {note}
      </p>

      <div data-bp-scroll-y data-bp-center className={LIST}>
        {shown.map((row, i) => (
          <button
            key={row.key}
            ref={i === 0 ? seedRef : undefined}
            type="button"
            data-bp-focusable
            data-bp-tile="wide"
            style={BP_ADDON_LIFT}
            onClick={() => {
              SFX.click();
              onChoose(row);
            }}
            className={BP_ADDON_CELL}
          >
            <BpSportsAddonMark src={row.addon.manifest.logo || row.meta.logo || row.meta.poster} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className={BP_ADDON_TITLE}>{row.meta.name}</span>
              <span className={BP_ADDON_SUB}>
                {row.match === "event"
                  ? `${row.addon.manifest.name} · ${t("Event matchup found")}`
                  : row.match === "channel"
                    ? `${row.addon.manifest.name} · ${t("Possible match · check the broadcast")}`
                    : row.addon.manifest.name}
              </span>
            </span>
            <Play size={22} strokeWidth={2.3} className="shrink-0" />
          </button>
        ))}

        {more > 0 && (
          <button
            type="button"
            data-bp-focusable
            data-bp-tile="wide"
            style={BP_ADDON_LIFT}
            onClick={() => {
              SFX.click();
              setLimit((n) => n + PAGE);
            }}
            className={BP_ADDON_CELL}
          >
            <span className={BP_ADDON_TITLE}>
              {t("More addon channels ({n} left)", { n: more })}
            </span>
          </button>
        )}
      </div>

      <div
        data-bp-row
        data-bp-scroll-x
        style={BP_ADDON_FLUSH}
        className="flex shrink-0 gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rows.length > 0 && (
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            ref={shown.length === 0 ? seedRef : undefined}
            aria-pressed={browse}
            onClick={() => {
              SFX.click();
              setBrowse((on) => !on);
              setQuery("");
              setLimit(PAGE);
            }}
            className={BP_ADDON_CHIP}
          >
            {browse ? t("Matching events") : t("Browse addon channels")}
          </button>
        )}
        {rows.length > 0 && (
          <button
            ref={searchRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.open();
              setBrowse(true);
              setTyping(true);
              if (typing && fieldRef.current) setBpFocus(fieldRef.current, { silent: true });
            }}
            className={`${BP_ADDON_CHIP} flex items-center justify-center gap-[clamp(8px,0.7vw,14px)]`}
          >
            <Search size={20} strokeWidth={2.3} />
            <span>{t("Search addon channels")}</span>
          </button>
        )}
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          ref={shown.length === 0 && rows.length === 0 ? seedRef : undefined}
          onClick={() => {
            SFX.click();
            sources.hardReload();
          }}
          className={BP_ADDON_CHIP}
        >
          {t("Refresh")}
        </button>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={() => {
            SFX.close();
            onClose();
          }}
          className={BP_ADDON_CHIP}
        >
          {t("Close")}
        </button>
      </div>

      {typing && (
        <BpKeyboard
          onChar={(c) => setQuery((prev) => (prev.length >= 40 ? prev : prev + c))}
          onBackspace={() => setQuery((prev) => prev.slice(0, -1))}
          onClear={() => setQuery("")}
        />
      )}
    </>
  );
}
