import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Pin, Search, Tv } from "lucide-react";
import { SFX } from "@/lib/sfx";
import type { IptvChannel } from "@/lib/iptv/types";
import { searchSportsChannels, type SportsChannelIndex } from "@/lib/sports/iptv-match";
import { toggleAttachedChannel } from "@/views/sports/source-store";
import { BP_ACTION_RING } from "../bp-action-style";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { BpKeyboard } from "../bp-keyboard";
import { bpFirstVisible } from "../bp-visible";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";

const QUERY_SCOPE = {
  paddingInline: 0,
  marginInline: 0,
  containIntrinsicSize: "auto 88px",
} as const;
const RESULT_SCOPE = {
  paddingInline: 0,
  marginInline: 0,
  containIntrinsicSize: "auto 92px",
} as const;

const ROW =
  "flex min-h-[clamp(58px,6.6vh,82px)] min-w-0 flex-1 items-center gap-[clamp(12px,1.1vw,22px)] rounded-[var(--bp-r-sm)] border border-transparent bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] text-start";

const SQUARE =
  "flex h-[clamp(58px,6.6vh,82px)] w-[clamp(58px,6.6vh,82px)] shrink-0 items-center justify-center rounded-[var(--bp-r-sm)] border";

const searchField = (lit: boolean) =>
  `flex h-[clamp(48px,6vh,70px)] min-w-0 flex-1 items-center gap-[clamp(9px,0.8vw,16px)] rounded-[var(--bp-r-md)] border bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] ${lit ? "border-[var(--bp-focus-stroke)]" : "border-[var(--bp-edge-2)]"}`;

export function BpSportsBroadcastSearch({
  index,
  league,
  leagueLabel,
  attachedIds,
  onPlay,
  onClose,
}: {
  index: SportsChannelIndex;
  league: string;
  leagueLabel: string;
  attachedIds: readonly string[];
  onPlay: (channel: IptvChannel) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const [query, setQuery] = useState("");
  const [lit, setLit] = useState(false);
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const deferred = useDeferredValue(query);
  const rows = useMemo(() => searchSportsChannels(index, deferred, 30), [index, deferred]);
  const attached = useMemo(() => new Set(attachedIds), [attachedIds]);

  useEffect(() => {
    const previous = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    const seed = fieldRef.current ?? seedRef.current;
    if (seed) setBpFocus(seed, { silent: true });
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  return (
    <div
      role="dialog"
      aria-label={t("Search your channels")}
      data-bp-dialog
      className="absolute inset-0 z-[75] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_86%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[92vh] w-[min(88vw,1040px)] flex-col gap-[clamp(12px,1.6vh,24px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(24px,2.6vw,44px)]">
        <div className="flex items-baseline justify-between gap-[clamp(12px,1.2vw,24px)]">
          <h2 className="font-display text-[calc(clamp(22px,3.1vh,38px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {t("Search your channels")}
          </h2>
          {league !== "" && (
            <span className="shrink-0 truncate text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {t("Always use for {league}", { league: leagueLabel })}
            </span>
          )}
        </div>

        <div data-bp-row style={QUERY_SCOPE}>
          <div data-bp-scroll-x className="flex items-center gap-[clamp(9px,0.9vw,16px)]">
            <span className={searchField(lit)}>
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
                aria-label={t("Search your channels")}
                placeholder={t("Channel name")}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
                className="min-w-0 flex-1 bg-transparent text-[calc(clamp(17px,2.4vh,31px)*var(--bp-up,1))] font-semibold text-ink outline-none placeholder:text-ink-subtle"
              />
            </span>
            <button
              ref={seedRef}
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.close();
                onClose();
              }}
              className={`h-[clamp(52px,6vh,74px)] shrink-0 rounded-full bg-[var(--bp-on)] px-[clamp(24px,2.1vw,42px)] text-[calc(clamp(15px,2vh,24px)*var(--bp-up,1))] font-bold text-ink ${BP_ACTION_RING}`}
            >
              {t("Done")}
            </button>
          </div>
        </div>

        <div
          data-bp-scroll-y
          data-bp-center
          className="-mx-[16px] flex max-h-[36vh] flex-col gap-[clamp(6px,0.7vh,11px)] overflow-y-auto px-[16px] py-[clamp(10px,1.2vh,18px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rows.length === 0 ? (
            <p className="text-[calc(clamp(14px,1.9vh,23px)*var(--bp-up,1))] leading-[1.55] text-ink-muted">
              {query
                ? t("No channel in your playlists matches that name.")
                : t("Type a channel name to find it in your playlists.")}
            </p>
          ) : (
            rows.map((row) => {
              const on = attached.has(row.channel.id);
              return (
                <div key={row.channel.id} data-bp-row style={RESULT_SCOPE}>
                  <div data-bp-scroll-x className="flex gap-[clamp(7px,0.7vw,13px)]">
                    <button
                      type="button"
                      data-bp-focusable
                      data-bp-tile="wide"
                      onClick={() => {
                        SFX.click();
                        onPlay(row.channel);
                      }}
                      className={`${ROW} ${BP_ACTION_RING}`}
                    >
                      {row.channel.logo ? (
                        <img
                          src={row.channel.logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="h-[clamp(36px,4.2vh,58px)] w-[clamp(36px,4.2vh,58px)] shrink-0 rounded-[8px] object-contain"
                        />
                      ) : (
                        <Tv size={26} strokeWidth={2.1} className="shrink-0" />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="truncate text-[calc(clamp(15px,2.05vh,25px)*var(--bp-up,1))] font-bold">
                          {row.channel.name}
                        </span>
                        {row.channel.group && (
                          <span className="truncate text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-semibold text-ink-subtle">
                            {row.channel.group}
                          </span>
                        )}
                      </span>
                    </button>
                    {league !== "" && (
                      <button
                        type="button"
                        data-bp-focusable
                        aria-pressed={on}
                        aria-label={t("Always use for {league}", { league: leagueLabel })}
                        onClick={() => {
                          SFX.click();
                          toggleAttachedChannel(league, row.channel.id);
                        }}
                        className={`${SQUARE} ${
                          on
                            ? "border-transparent bg-[var(--bp-on)] text-ink"
                            : "border-[var(--bp-edge-2)] text-ink-subtle"
                        } ${BP_ACTION_RING}`}
                      >
                        <Pin size={22} strokeWidth={2.3} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <BpKeyboard
          onChar={(c) => setQuery((prev) => (prev.length >= 40 ? prev : prev + c))}
          onBackspace={() => setQuery((prev) => prev.slice(0, -1))}
          onClear={() => setQuery("")}
        />
      </div>
    </div>
  );
}
