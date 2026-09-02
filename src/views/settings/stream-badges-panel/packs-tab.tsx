import { useEffect, useRef, useState } from "react";
import { Download, Link2, Trash2, Upload } from "lucide-react";
import { badgeLabel, defaultBadgeSrc, type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { safeFetch } from "@/lib/safe-fetch";
import {
  applyArtPack,
  BADGE_STUDIOS,
  COMMUNITY_PACKS,
  exportBadgesJson,
  importBadgesJson,
  parsePackText,
  resetAllBadges,
  type BadgeImportResult,
  type CommunityPack,
} from "@/lib/stream-badges";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { removeStreamBadgePack, useStreamBadgePacks } from "@/lib/community-badge-packs";
import { Section, useSettingsActiveContext } from "../shared";
import { SettingRow } from "../kit";
import { requestThemeLibrary } from "@/views/settings/theme-panel/library-open-store";
import { MarketCta } from "@/views/settings/theme-panel/custom-themes-section/community-store/market/market-cta";
import type { IconThumb } from "@/views/settings/theme-panel/custom-themes-section/community-store/market/icon-fan";
import { ConfirmButton } from "./confirm-button";
import { PackCard } from "./pack-card";

const BADGE_DOORWAY_PREVIEW: IconThumb[] = (
  ["4k-uhd", "dv", "atmos", "remux", "hevc"] as BadgeKind[]
).map((kind) => ({ src: defaultBadgeSrc(kind), alt: badgeLabel(kind) }));

function importToast(t: ReturnType<typeof useT>, r: BadgeImportResult): void {
  if (r.remapped === 0 && r.rules === 0) {
    emitListToast(t("Nothing usable in that file"));
    return;
  }
  emitListToast(t("{a} badges remapped, {b} rules added", { a: r.remapped, b: r.rules }));
}

function PacksSection() {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const installFromUrl = async (packUrl: string, id: string) => {
    setBusy(id);
    try {
      const res = await safeFetch(packUrl);
      if (!res.ok) {
        emitListToast(t("Couldn't reach that pack (HTTP {n})", { n: res.status }));
        return;
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = parsePackText(text);
      } catch {
        emitListToast(t("That pack's file isn't valid JSON"));
        return;
      }
      importToast(t, importBadgesJson(json));
      setInstalled((m) => ({ ...m, [id]: true }));
    } catch {
      emitListToast(t("Couldn't reach that pack"));
    } finally {
      setBusy(null);
    }
  };

  const installPack = (p: CommunityPack) => {
    if (p.kind === "art") {
      const n = applyArtPack(p.art);
      emitListToast(t("{a} badges remapped, {b} rules added", { a: n, b: 0 }));
      setInstalled((m) => ({ ...m, [p.id]: true }));
      return;
    }
    void installFromUrl(p.url, p.id);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importToast(t, importBadgesJson(parsePackText(String(reader.result || ""))));
      } catch {
        emitListToast(t("That file isn't valid JSON"));
      }
    };
    reader.readAsText(f);
  };

  return (
    <div ref={rootRef} className="scroll-mt-24">
    <Section
      title={t("Packs & import")}
      subtitle={t("One-click community packs. Rulesets bring full badge sets with their own matching; art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link on the Nuvio Discord or Reddit imports here too.")}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {COMMUNITY_PACKS.map((p) => (
          <PackCard
            key={p.id}
            pack={p}
            busy={busy === p.id}
            installed={!!installed[p.id]}
            onInstall={() => installPack(p)}
          />
        ))}
      </div>
      <SettingRow
        wide
        label={t("Make your own")}
        desc={t("Build a pack in any of these, export the JSON, host it as a gist, and paste the raw link below.")}
      >
        <div className="flex w-full flex-wrap gap-x-5 gap-y-1.5">
          {BADGE_STUDIOS.map((s) => (
            <button
              key={s.url}
              onClick={() => openUrl(s.url)}
              title={s.blurb}
              className="text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
            >
              {s.name} ↗
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        wide
        icon={<Link2 size={18} strokeWidth={2} />}
        label={t("Import any pack")}
        desc={t("Any badges.json link works: a raw gist, Pastebin, or repo file. Broken JSON gets auto-repaired.")}
      >
        <div className="flex w-full flex-col gap-2.5">
          <div className="flex items-stretch gap-1.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) void installFromUrl(url.trim(), "url");
              }}
              placeholder="https://gist.githubusercontent.com/…/badges.json"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 rounded-md bg-canvas px-4 font-mono text-[12.5px] text-ink outline-none placeholder:font-sans placeholder:text-ink-subtle"
            />
            <button
              onClick={() => url.trim() && void installFromUrl(url.trim(), "url")}
              disabled={!url.trim() || busy === "url"}
              className="harbor-press-pop inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-ink px-6 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Download size={16} />
              {busy === "url" ? t("Fetching…") : t("Import")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <Upload size={14} />
              {t("Import a file instead")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(exportBadgesJson());
                emitListToast(t("Setup copied to clipboard as JSON"));
              }}
              className="h-9 rounded-md px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              {t("Export my setup")}
            </button>
            <ConfirmButton
              label={t("Reset everything")}
              confirmLabel={t("Tap again to reset everything")}
              onConfirm={() => {
                resetAllBadges();
                emitListToast(t("All badges back to default"));
              }}
            />
          </div>
        </div>
      </SettingRow>
    </Section>
    </div>
  );
}

function CommunityInstalledSection() {
  const t = useT();
  const packs = useStreamBadgePacks();
  if (packs.length === 0) return null;
  return (
    <Section
      title={t("Downloaded from community")}
      subtitle={t("Badge art packs you installed from the community store. Remove one to put its badges back to default.")}
    >
      {packs.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-md bg-elevated px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={p.name}>
            {p.name}
            {p.author ? <span className="text-ink-subtle"> {t("by {name}", { name: p.author })}</span> : null}
          </span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-ink-subtle">
            {t("{n} badges", { n: p.kinds.length })}
          </span>
          <button
            onClick={() => {
              removeStreamBadgePack(p.id);
              emitListToast(t("Pack removed, badges back to default"));
            }}
            aria-label={t("Remove pack")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </Section>
  );
}

export function PacksTab() {
  const t = useT();
  const [browseOpen, setBrowseOpen] = useState(false);
  const { setActive } = useSettingsActiveContext();
  const onMarketplace = () => {
    setActive("theme");
    requestThemeLibrary({ tab: "community", storeTab: "badges" });
  };

  return (
    <>
      <MarketCta
        variant="browse"
        label={t("View community badge packs")}
        sublabel={t("User-made badge packs from the community store")}
        preview={BADGE_DOORWAY_PREVIEW}
        onClick={onMarketplace}
      />

      <button
        type="button"
        onClick={() => setBrowseOpen((v) => !v)}
        className="-mt-3 self-start text-[13px] font-semibold text-accent transition-opacity hover:opacity-80"
      >
        {browseOpen ? t("Hide curated packs") : t("Or browse curated packs and import a link")}
      </button>

      <CommunityInstalledSection />

      {browseOpen && <PacksSection />}
    </>
  );
}
