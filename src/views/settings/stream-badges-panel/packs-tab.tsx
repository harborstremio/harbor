import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Link2,
  Package,
  Store,
  Trash2,
  Upload,
} from "../icons";
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
import { tvFocus } from "@/lib/keyboard-navigation";
import { Section, settingsAnchor, useSettingsActiveContext } from "../shared";
import { ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { SButton, SRow } from "../ui";
import { usePageActions } from "../page-actions";
import { requestThemeLibrary } from "@/views/settings/theme-panel/library-open-store";
import { handoffFocus, ringActive } from "./focus-handoff";
import { PackCard } from "./pack-card";

const FIELD =
  "h-11 min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
  const packsRef = useRef<HTMLDivElement>(null);
  const anchor = settingsAnchor(t("Packs & import"));
  useEffect(() => {
    const first = ringActive() ? packsRef.current?.querySelector("button") : null;
    if (first) {
      tvFocus(first);
      return;
    }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [anchor]);

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
    <Section
      title={t("Packs & import")}
      subtitle={t("Rulesets bring a full badge set with their own matching. Art remaps only swap the pictures on Harbor's built-in badges. Anything shared as a badges.json link imports here too.")}
    >
      <div ref={packsRef} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
        desc={t("Build a pack in one of these tools, export the JSON, host it as a gist, then paste the raw link below.")}
      >
        <div className="flex w-full flex-wrap items-center gap-2.5">
          {BADGE_STUDIOS.map((s) => (
            <SButton key={s.url} onClick={() => openUrl(s.url)} title={s.blurb}>
              {s.name}
              <ExternalLink size={16} className="text-ink-subtle" />
            </SButton>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        wide
        icon={<Link2 size={18} strokeWidth={2} />}
        label={t("Import from a link")}
        desc={t("Any badges.json address works: a raw gist, Pastebin, or a file in a repo. Broken JSON gets repaired automatically.")}
      >
        <div className="flex w-full max-w-[680px] flex-wrap items-center gap-2.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) void installFromUrl(url.trim(), "url");
            }}
            placeholder="https://gist.githubusercontent.com/…/badges.json"
            spellCheck={false}
            className={`${FIELD} min-w-[260px] flex-1 font-mono`}
          />
          <button
            type="button"
            onClick={() => {
              if (url.trim() && busy !== "url") void installFromUrl(url.trim(), "url");
            }}
            disabled={!url.trim()}
            aria-busy={busy === "url"}
            className={ROW_ACTION_PRIMARY}
          >
            <Download size={18} />
            {busy === "url" ? t("Fetching…") : t("Import")}
          </button>
        </div>
      </SettingRow>

      <SettingRow
        label={t("Import from a file")}
        desc={t("Pick a badges.json that is already saved on this computer.")}
      >
        <SButton onClick={() => fileRef.current?.click()}>
          <Upload size={18} />
          {t("Choose a file")}
        </SButton>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </SettingRow>

      <SettingRow
        label={t("Export my setup")}
        desc={t("Copies your badge art and rules to the clipboard as JSON, ready to paste into a gist and share.")}
      >
        <SButton
          onClick={() => {
            void navigator.clipboard?.writeText(exportBadgesJson());
            emitListToast(t("Setup copied to clipboard as JSON"));
          }}
        >
          {t("Copy JSON")}
        </SButton>
      </SettingRow>
    </Section>
  );
}

function CommunityInstalledSection() {
  const t = useT();
  const packs = useStreamBadgePacks();
  if (packs.length === 0) return null;
  return (
    <Section
      title={t("Downloaded from community")}
      subtitle={t("Badge art packs you installed from the community store. Remove one to put its badges back to Harbor's default.")}
    >
      {packs.map((p) => (
        <SettingRow
          key={p.id}
          label={p.name}
          desc={
            p.author
              ? t("{n} badges, by {name}", { n: p.kinds.length, name: p.author })
              : t("{n} badges", { n: p.kinds.length })
          }
        >
          <SButton
            variant="danger"
            onClick={() =>
              handoffFocus(() => {
                removeStreamBadgePack(p.id);
                emitListToast(t("Pack removed, badges back to default"));
              })
            }
          >
            <Trash2 size={18} />
            {t("Remove")}
          </SButton>
        </SettingRow>
      ))}
    </Section>
  );
}

export function PacksTab() {
  const t = useT();
  const [browseOpen, setBrowseOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const { setActive } = useSettingsActiveContext();
  const onMarketplace = () => {
    setActive("theme");
    requestThemeLibrary({ tab: "community", storeTab: "badges" });
  };

  usePageActions(
    [
      {
        id: "badges-reset-all",
        tone: "danger",
        label: armed ? "Tap again to reset" : "Reset everything to default",
        onSelect: () => {
          if (!armed) {
            setArmed(true);
            window.setTimeout(() => setArmed(false), 3000);
            return;
          }
          setArmed(false);
          resetAllBadges();
          emitListToast(t("All badges back to default"));
        },
      },
    ],
    armed
      ? "Every badge goes back to Harbor's art and every custom rule is removed. There is no undo."
      : undefined,
  );

  return (
    <>
      <Section
        title={t("Where badges come from")}
        subtitle={t("A pack swaps Harbor's built-in badge art, or adds whole new badges of its own.")}
      >
        <SRow
          title={t("Browse community badge packs")}
          description={t("User-made packs from the community store, refreshed every week.")}
          leading={<Store size={20} strokeWidth={2} />}
          trailing={
            <ChevronRight size={18} className="shrink-0 text-ink-subtle rtl:-scale-x-100" />
          }
          onClick={onMarketplace}
        />
        <SRow
          title={t("Curated packs and link import")}
          description={t("A short hand-picked list, plus a box for pasting any badges.json link you were sent.")}
          leading={<Package size={20} strokeWidth={2} />}
          trailing={
            browseOpen ? (
              <ChevronUp size={18} className="shrink-0 text-ink-subtle" />
            ) : (
              <ChevronDown size={18} className="shrink-0 text-ink-subtle" />
            )
          }
          onClick={() => setBrowseOpen((v) => !v)}
        />
      </Section>

      <CommunityInstalledSection />

      {browseOpen && <PacksSection />}
    </>
  );
}
