import { Check, ExternalLink, Key, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { installAddon, isInstalled } from "@/lib/addon-store";
import { createRealDebrid } from "@/lib/debrid/realdebrid";
import { createTorbox } from "@/lib/debrid/torbox";
import { useT } from "@/lib/i18n";
import {
  JL_DEBRID_OPTIONS,
  JL_TORRENTIO_ADDON_ID,
  JL_TORRENTIO_MANIFEST_URL,
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

type AddonState = "idle" | "installing" | "installed" | "failed";

export function MoviesStep({ onNoDebrid, onTorrentio }: { onNoDebrid: () => void; onTorrentio: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const [addon, setAddon] = useState<AddonState>(() => (isInstalled(JL_TORRENTIO_ADDON_ID) ? "installed" : "idle"));
  const hasKey = !!(settings.rdKey.trim() || settings.tbKey.trim());

  // Torrentio finds the sources; the debrid service plays them. Install it as soon as a key works.
  const installTorrentio = async () => {
    if (isInstalled(JL_TORRENTIO_ADDON_ID)) {
      setAddon("installed");
      onTorrentio();
      return;
    }
    setAddon("installing");
    try {
      await installAddon(JL_TORRENTIO_ADDON_ID, JL_TORRENTIO_MANIFEST_URL);
      setAddon("installed");
      onTorrentio();
    } catch {
      setAddon("failed");
    }
  };

  // A key that came with the account (set up on another device) needs Torrentio here too.
  // Keys typed on this screen install it after they verify instead.
  useEffect(() => {
    if (hasKey && !isInstalled(JL_TORRENTIO_ADDON_ID)) void installTorrentio();
    // Runs once, for the key this screen opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 4 of 4 · Movies & Shows")}
      </span>
      <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink">
        {t("Connect Real-Debrid or TorBox")}
      </h1>
      <p className="text-[14.5px] leading-relaxed text-ink-muted">
        {t(
          "Paste the key from your Real-Debrid or TorBox account. You only need one. We'll add Torrentio for you, which finds the movies and shows your account plays instantly.",
        )}
      </p>
      <div className="flex flex-col gap-3">
        {JL_DEBRID_OPTIONS.map((option) => (
          <DebridKeyRow key={option.id} option={option} onVerified={() => void installTorrentio()} />
        ))}
      </div>
      {hasKey && (
        <div className="flex items-center gap-2.5 text-[13px]">
          {addon === "installed" ? (
            <>
              <Check size={15} className="text-accent" />
              <span className="text-ink">{t("Torrentio added")}</span>
            </>
          ) : addon === "installing" ? (
            <>
              <Loader2 size={15} className="animate-spin text-ink-subtle" />
              <span className="text-ink-muted">{t("Adding Torrentio")}</span>
            </>
          ) : (
            <>
              {addon === "failed" && <span className="text-danger">{t("Torrentio couldn't be added.")}</span>}
              <button
                onClick={() => void installTorrentio()}
                className="rounded-full border border-edge px-3.5 py-1.5 font-medium text-ink hover:bg-raised"
              >
                {addon === "failed" ? t("Try again") : t("Add Torrentio")}
              </button>
            </>
          )}
        </div>
      )}
      {!hasKey && (
        <button
          onClick={onNoDebrid}
          className="w-fit text-[13px] text-ink-subtle underline-offset-4 hover:text-ink hover:underline"
        >
          {t("I don't have Real-Debrid or TorBox")}
        </button>
      )}
      <p className="text-[12px] text-ink-subtle">{t("Only stream content you have the right to watch.")}</p>
    </div>
  );
}

function keyPatch(option: JlDebridOption, key: string): Partial<Settings> {
  return option.settingsKey === "rdKey" ? { rdKey: key } : { tbKey: key };
}

function DebridKeyRow({ option, onVerified }: { option: JlDebridOption; onVerified: () => void }) {
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
      if (result.ok) onVerified();
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
