import { ExternalLink, Key, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createRealDebrid } from "@/lib/debrid/realdebrid";
import { createTorbox } from "@/lib/debrid/torbox";
import { useT } from "@/lib/i18n";
import {
  JL_DEBRID_OPTIONS,
  describeDebridVerification,
  verificationFromFailure,
  type DebridStatusTone,
  type DebridVerification,
  type JlDebridOption,
} from "@/lib/jl/onboarding";
import { useSettings, type Settings } from "@/lib/settings";
import { openUrl } from "@/lib/window";

const TONE_CLASS: Record<DebridStatusTone, string> = {
  neutral: "text-ink-subtle",
  good: "text-accent",
  warn: "text-amber-300",
  bad: "text-danger",
};

export function DebridStep() {
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Movies & Shows · Debrid")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Connect Real-Debrid or TorBox")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Use your own subscription for instant, cached playback. Your key stays on this device and is only sent to the service it belongs to.",
          )}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {JL_DEBRID_OPTIONS.map((option) => (
          <DebridKeyRow key={option.id} option={option} />
        ))}
      </div>
    </div>
  );
}

function keyPatch(option: JlDebridOption, key: string): Partial<Settings> {
  return option.settingsKey === "rdKey" ? { rdKey: key } : { tbKey: key };
}

function DebridKeyRow({ option }: { option: JlDebridOption }) {
  const { settings, update } = useSettings();
  const t = useT();
  const saved = settings[option.settingsKey];
  const [draft, setDraft] = useState(saved);
  const [verification, setVerification] = useState<DebridVerification>(
    saved ? { state: "saved" } : { state: "empty" },
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const verify = async () => {
    const key = draft.trim();
    if (!key) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    update(keyPatch(option, key));
    setVerification({ state: "checking" });
    const client = option.id === "realdebrid" ? createRealDebrid(key) : createTorbox(key);
    try {
      const result = await client.account(controller.signal);
      if (controller.signal.aborted) return;
      setVerification(
        result.ok ? { state: "verified", account: result.data } : verificationFromFailure(result.status),
      );
    } catch {
      if (!controller.signal.aborted) setVerification({ state: "unreachable" });
    }
  };

  const status = describeDebridVerification(verification, Date.now());
  const checking = verification.state === "checking";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-ink">{option.label}</span>
        <button
          onClick={() => openUrl(option.keyUrl)}
          className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {t("Get your key")} <ExternalLink size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-edge bg-canvas px-4 transition-colors focus-within:border-ink-subtle">
          <Key size={15} className="text-ink-subtle" />
          <input
            type="password"
            value={draft}
            onChange={(e) => {
              abortRef.current?.abort();
              const next = e.target.value;
              setDraft(next);
              update(keyPatch(option, next.trim()));
              setVerification(next.trim() ? { state: "saved" } : { state: "empty" });
            }}
            onKeyDown={(e) => e.key === "Enter" && void verify()}
            placeholder={t(option.keyHint)}
            spellCheck={false}
            autoComplete="off"
            className="h-11 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle/60"
          />
        </div>
        <button
          onClick={() => void verify()}
          disabled={!draft.trim() || checking}
          className="flex h-11 min-w-[100px] items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : t("Verify")}
        </button>
      </div>
      <span className={`text-[12.5px] ${TONE_CLASS[status.tone]}`}>{t(status.label, status.vars)}</span>
    </div>
  );
}
