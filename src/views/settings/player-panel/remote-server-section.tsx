import { t as tr } from "@/lib/i18n";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Check, Loader2, Wifi, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ToggleRow, settingsAnchor } from "../shared";

type TestResult = { ok: boolean; message: string };

const PILL = {
  off: { label: "Off", dot: "bg-ink-subtle", chip: "bg-ink-subtle/15 text-ink-muted" },
  checking: { label: "Checking", dot: "bg-ink-subtle", chip: "bg-ink-subtle/15 text-ink-muted" },
  connected: { label: "Connected", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-400" },
  unreachable: { label: "Unreachable", dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

async function probeServer(url: string): Promise<TestResult> {
  const started = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${url}/settings`, { method: "GET", signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok)
      return {
        ok: false,
        message: tr("The server answered with status {status}. Is that a streaming server?", { status: res.status }),
      };
    const ms = Math.max(1, Math.round(performance.now() - started));
    return { ok: true, message: tr("Server reachable in {ms}ms. Harbor will use it for torrent streaming.", { ms }) };
  } catch {
    return {
      ok: false,
      message: tr(
        "Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.",
      ),
    };
  }
}

export function RemoteServerSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const saved = settings.remoteStreamServerUrl;
  const [draft, setDraft] = useState(saved);
  const [reach, setReach] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => setDraft(saved), [saved]);

  useEffect(() => {
    setReach(null);
    setResult(null);
    if (!saved) return;
    let alive = true;
    void probeServer(saved).then((r) => {
      if (alive) setReach(r.ok);
    });
    return () => {
      alive = false;
    };
  }, [saved]);

  const commit = () => {
    const normalized = normalizeServerUrl(draft);
    setDraft(normalized);
    if (normalized !== saved) update({ remoteStreamServerUrl: normalized });
  };

  const test = async () => {
    if (!saved || testing) return;
    setTesting(true);
    try {
      const r = await probeServer(saved);
      setResult(r);
      setReach(r.ok);
    } finally {
      setTesting(false);
    }
  };

  const pill = !saved ? PILL.off : reach === null ? PILL.checking : reach ? PILL.connected : PILL.unreachable;

  return (
    <section
      id={settingsAnchor("Remote streaming server")}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Remote streaming server")}</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {t(
              "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.",
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${pill.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {t(pill.label)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          onBlur={commit}
          placeholder="http://192.168.1.50:11470"
          spellCheck={false}
          autoComplete="off"
          className="h-11 flex-1 rounded-xl border border-edge bg-canvas px-3.5 font-mono text-[13px] text-ink transition-colors focus:border-accent"
        />
        {saved && (
          <button
            type="button"
            onClick={() => update({ remoteStreamServerUrl: "" })}
            className="h-11 shrink-0 rounded-xl border border-edge px-4 text-[13px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Forget")}
          </button>
        )}
      </div>

      {saved && (
        <>
          <ToggleRow
            label={t("Use exclusively (never fall back to local)")}
            sub={t(
              "If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.",
            )}
            value={settings.remoteStreamServerStrict}
            onChange={(v) => update({ remoteStreamServerStrict: v })}
          />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-ink">{t("Test connection")}</span>
              <span className="text-[11.5px] text-ink-subtle">
                {t("Probes the server's settings endpoint from this device.")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void test()}
              disabled={testing}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-60"
            >
              {testing ? (
                <Loader2 size={13} strokeWidth={1.9} className="animate-spin" />
              ) : (
                <Wifi size={13} strokeWidth={1.9} />
              )}
              {testing ? t("Testing") : t("Run test")}
            </button>
          </div>
          {result && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${result.ok ? "border-accent/40 bg-accent/10" : "border-danger/40 bg-danger/10"}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${result.ok ? "bg-accent/25 text-accent" : "bg-danger/25 text-danger"}`}
              >
                {result.ok ? <Check size={12} strokeWidth={2.4} /> : <X size={12} strokeWidth={2.4} />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`text-[12.5px] font-medium ${result.ok ? "text-ink" : "text-danger"}`}>
                  {result.ok ? t("Server reachable") : t("Test failed")}
                </span>
                <span className="text-[11.5px] text-ink-subtle">{result.message}</span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
