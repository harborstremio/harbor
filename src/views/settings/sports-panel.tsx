import { Check, ExternalLink, Loader2, PlugZap, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  SPORTS_KEYS,
  testSportsKey,
  type KeyTestResult,
  type SportsKeyDef,
} from "@/lib/jl/sports/sports-keys";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { openUrl } from "@/lib/window";
import { KeyField, Section, ToggleRow } from "./shared";
import { SportsArtSection } from "./sports-art-panel";

type PluginField =
  | "sportsTopGames"
  | "sportsChannelFinder"
  | "sportsScoreTicker"
  | "sportsShowOdds";

const PLUGINS: Array<{ field: PluginField; label: string; sub: string }> = [
  {
    field: "sportsTopGames",
    label: "Top games",
    sub: "Ranks every game for you into the Top 10 hero and cards at the top of the Sports Hub.",
  },
  {
    field: "sportsChannelFinder",
    label: "Smart Channel Finder",
    sub: "Finds which of your live channels carry each game, so Watch plays it in one step.",
  },
  {
    field: "sportsScoreTicker",
    label: "Your teams ticker",
    sub: "A live-score strip for the teams you follow, from kick-off to the final.",
  },
  {
    // The same setting as the Sports page's own odds switch, so both stay in step.
    field: "sportsShowOdds",
    label: "Odds overlay",
    sub: "Moneyline and spread on game cards. Uses The Odds API when you add its key, otherwise ESPN's line.",
  },
];

export function SportsPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("Sports keys")}
        subtitle={t(
          "JL Media Vision brings no sports data of its own. Each key is yours, stays on your devices and syncs with your account. Leave a key empty to keep that feature off.",
        )}
      >
        <div className="flex flex-col gap-7">
          {SPORTS_KEYS.map((def) => (
            <SportsKeyRow key={def.id} def={def} />
          ))}
        </div>
      </Section>
      <Section
        title={t("Sports Hub plugins")}
        subtitle={t("Switch Sports Hub features on or off. Changes apply right away.")}
      >
        <div className="flex flex-col gap-2">
          {PLUGINS.map((p) => (
            <ToggleRow
              key={p.field}
              label={t(p.label)}
              sub={t(p.sub)}
              value={settings[p.field]}
              onChange={(v) => update({ [p.field]: v } as Partial<Settings>)}
            />
          ))}
        </div>
      </Section>
      <SportsArtSection />
    </>
  );
}

function SportsKeyRow({ def }: { def: SportsKeyDef }) {
  const t = useT();
  const { settings, update } = useSettings();
  const stored = settings[def.field];
  const [draft, setDraft] = useState(stored);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<KeyTestResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const savedTimer = useRef(0);

  // A key synced in from the account replaces an untouched draft.
  const lastStored = useRef(stored);
  useEffect(() => {
    if (lastStored.current === stored) return;
    setDraft((d) => (d.trim() === lastStored.current.trim() ? stored : d));
    lastStored.current = stored;
  }, [stored]);

  useEffect(
    () => () => {
      controller.current?.abort();
      window.clearTimeout(savedTimer.current);
    },
    [],
  );

  const save = () => {
    update({ [def.field]: draft.trim() } as Partial<Settings>);
    setResult(null);
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1400);
  };

  const runTest = async () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setTesting(true);
    setResult(null);
    try {
      const r = await testSportsKey(def.id, draft, (url, init) => safeFetch(url, init), c.signal);
      if (!c.signal.aborted) setResult(r);
    } catch {
      if (!c.signal.aborted) setResult({ ok: false, message: "The test didn't finish. Try again." });
    } finally {
      if (!c.signal.aborted) setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <KeyField
        label={def.name}
        placeholder={t(def.placeholder)}
        value={draft}
        onChange={(v) => {
          setDraft(v);
          setResult(null);
        }}
        onSave={save}
        saved={saved}
        help={t(def.unlocks)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openUrl(def.signupUrl)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          <ExternalLink size={13} />
          {def.freePlan ? t("Get a free key") : t("Get a key")}
        </button>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={testing || !draft.trim()}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
          {t("Test")}
        </button>
        {result && (
          <span
            role="status"
            className={`flex min-w-0 items-center gap-1.5 text-[12.5px] ${result.ok ? "text-accent" : "text-danger"}`}
          >
            {result.ok ? <Check size={14} strokeWidth={2.6} /> : <X size={14} strokeWidth={2.6} />}
            <span className="min-w-0">{t(result.message)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
