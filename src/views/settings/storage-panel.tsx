import { useSubTabs } from "./sub-tabs";
import { StreamCacheSection } from "./player-panel/p2p-advanced-section";
import { Check, Database, HardDrive, Trash2 } from "./icons";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { clearPickerCache } from "@/lib/picker-cache";
import { clearMangaCache } from "@/lib/manga/api";
import { clearEpg } from "@/lib/iptv/epg-store";
import { clearPlaylistCache } from "@/lib/iptv/store";
import { clearSeriesInfoCache } from "@/lib/iptv/xtream-vod";
import { clearDeadStreams } from "@/lib/dead-streams";
import { clearResurfaceCache } from "@/lib/cw-resurface";
import { Section } from "./shared";
import { ROW_DESC, SettingGroup, SettingRow } from "./kit";
import { TempFilesCard } from "./temp-files-card";

const CLEAR_BTN =
  "harbor-press-pop flex h-11 shrink-0 items-center gap-2 rounded-[8px] border px-4 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const CLEAR_IDLE = `${CLEAR_BTN} border-edge-soft bg-elevated text-ink-subtle hover:border-danger/40 hover:text-danger`;
const CLEAR_ARMED = `${CLEAR_BTN} border-danger/40 bg-elevated text-danger`;
const CLEAR_DONE = `${CLEAR_BTN} border-edge-soft bg-elevated text-success`;

const READOUT = "shrink-0 text-[15.5px] tabular-nums text-ink-muted";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function fmtPercent(pct: number): string {
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

function localStorageBreakdown(): { total: number; top: { key: string; bytes: number }[] } {
  let total = 0;
  const rows: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const bytes = (localStorage.getItem(key)?.length ?? 0) * 2 + key.length * 2;
      total += bytes;
      rows.push({ key, bytes });
    }
  } catch {
    return { total: 0, top: [] };
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return { total, top: rows.slice(0, 6) };
}

function friendlyKey(key: string): string {
  const known: Record<string, string> = {
    "harbor.jikancatalog2": "Anime catalog cache",
    "harbor.awards.wikidata": "Awards cache",
    "harbor.heroPool": "Featured titles cache",
    "harbor.settings.shared": "Shared preferences",
    "harbor.settings": "Profile preferences",
    "harbor.armcache": "Anime title matching",
  };
  const base = key.replace(/\.v\d+$/, "");
  if (known[base]) return known[base];
  const words = key
    .replace(/^harbor\./, "")
    .replace(/\.v\d+$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_.]/g, " ")
    .trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ClearRow({
  title,
  sub,
  onClear,
}: {
  title: string;
  sub: string;
  onClear: () => void;
}) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3200);
    return () => window.clearTimeout(timer);
  }, [armed]);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), 2200);
    return () => window.clearTimeout(timer);
  }, [done]);

  const click = () => {
    if (done) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setFailed(false);
    try {
      onClear();
      setDone(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <SettingRow label={title} desc={<>{sub}{failed && <span role="alert" className="mt-1 block text-danger">{t("Could not clear this cache. Try again.")}</span>}</>}>
      <button
        type="button"
        onClick={click}
        onBlur={() => setArmed(false)}
        aria-label={done ? t("{name} cleared", { name: title }) : armed ? t("Confirm clearing {name}", { name: title }) : t("Clear {name}", { name: title })}
        className={done ? CLEAR_DONE : armed ? CLEAR_ARMED : CLEAR_IDLE}
      >
        {done ? <Check size={18} strokeWidth={2.4} /> : <Trash2 size={18} strokeWidth={1.9} />}
        {done ? t("Cleared") : armed ? t("Confirm clear") : t("Clear")}
      </button>
    </SettingRow>
  );
}

type Tab = "overview" | "video" | "caches";

export function StoragePanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("overview");
  const [tick, setTick] = useState(0);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);

  const refresh = () => setTick((v) => v + 1);

  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive && e && typeof e.usage === "number" && typeof e.quota === "number") {
          setEstimate({ usage: e.usage, quota: e.quota });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  const ls = useMemo(() => localStorageBreakdown(), [tick]);
  const pct = estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  useSubTabs(
    [
      { id: "overview", label: t("Overview") },
      { id: "video", label: t("Video files") },
      { id: "caches", label: t("Caches") },
    ],
    tab,
    (id) => setTab(id as Tab),
  );

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "overview" && (
        <>
          <Section
            title={t("Storage overview")}
            subtitle={t(
              "Review local app data and caches. Cached pages rebuild as you browse; temporary video files are managed separately.",
            )}
          >
            <SettingGroup>
              {estimate && (
                <SettingRow
                  wide
                  icon={<HardDrive size={18} strokeWidth={1.9} />}
                  label={t("App data cache")}
                  desc={t("{used} used within a {quota} storage allowance. Video downloads and other files on disk are not included.", {
                    used: fmtBytes(estimate.usage),
                    quota: fmtBytes(estimate.quota),
                  })}
                >
                  <div className="flex w-full max-w-[520px] items-center gap-4">
                    <div role="meter" aria-label={t("App data cache usage")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={fmtPercent(pct)} className="h-2 min-w-0 flex-1 rounded-full bg-raised">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }}
                      />
                    </div>
                    <span className={`w-[72px] text-end ${READOUT}`}>{fmtPercent(pct)}</span>
                  </div>
                </SettingRow>
              )}

              <SettingRow
                icon={<Database size={18} strokeWidth={1.9} />}
                label={t("Settings storage")}
                desc={t(
                  "Your preferences, layout state, and small lookup caches. Clearing caches shrinks this.",
                )}
              >
                <span className={READOUT}>{fmtBytes(ls.total)}</span>
              </SettingRow>
            </SettingGroup>
          </Section>

          {ls.top.length > 0 && (
            <Section
              title={t("Settings storage breakdown")}
              subtitle={t(
                "The six largest local settings entries, including preferences and lookup data.",
              )}
            >
              <SettingGroup>
                {ls.top.map((row) => (
                  <SettingRow key={row.key} label={t(friendlyKey(row.key))}>
                    <span className={READOUT}>{fmtBytes(row.bytes)}</span>
                  </SettingRow>
                ))}
              </SettingGroup>
            </Section>
          )}
        </>
      )}
      {tab === "video" && (
        <>
          <StreamCacheSection />
          <TempFilesCard />
        </>
      )}
      {tab === "caches" && (
        <Section
          title={t("Clear caches")}
          subtitle={t(
            "Safe to clear anytime. Nothing here touches your watch history, library, themes, or sign-ins.",
          )}
        >
          <SettingGroup>
            <ClearRow
              title={t("Stream picker cache")}
              sub={t(
                "Remembered source lists per title. Clears stale results after changing addons or debrid.",
              )}
              onClear={() => {
                clearPickerCache();
                refresh();
              }}
            />
            <ClearRow
              title={t("Manga browse cache")}
              sub={t("Cached chapter lists and browse pages. Downloads stay untouched.")}
              onClear={() => {
                clearMangaCache();
                refresh();
              }}
            />
            <ClearRow
              title={t("Live TV caches")}
              sub={t(
                "Parsed playlists, program guide, and series info. Re-downloads on next open.",
              )}
              onClear={() => {
                clearEpg();
                clearPlaylistCache();
                clearSeriesInfoCache();
                refresh();
              }}
            />
            <ClearRow
              title={t("Dead stream marks")}
              sub={t("Sources Harbor flagged as broken. Clear to give them another chance.")}
              onClear={() => {
                clearDeadStreams();
                refresh();
              }}
            />
            <ClearRow
              title={t("Continue Watching suggestions cache")}
              sub={t("Resurface picks for the home rail. Rebuilds overnight.")}
              onClear={() => {
                clearResurfaceCache();
                refresh();
              }}
            />
          </SettingGroup>

          <p className={`max-w-[70ch] ${ROW_DESC}`}>
            {t(
              "Downloaded themes are managed in Theme & appearance. Video and manga downloads are managed on the Downloads page.",
            )}
          </p>
        </Section>
      )}
    </div>
  );
}
