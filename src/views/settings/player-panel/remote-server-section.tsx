import { Check, Loader2, Wifi, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { t as tr } from "@/lib/i18n";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { ROW_ACTION, ROW_DESC, SettingGroup, SettingRow } from "../kit";
import { BADGE_BASE } from "./choice";

type TestResult = { ok: boolean; message: string };

const FIELD =
  "h-11 w-full max-w-[520px] min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 font-mono text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PILL = {
  off: { label: "Not set", dot: "bg-ink-subtle", chip: "bg-elevated text-ink-subtle" },
  checking: { label: "Checking", dot: "bg-ink-subtle", chip: "bg-elevated text-ink-subtle" },
  connected: { label: "Connected", dot: "bg-success", chip: "bg-elevated text-success" },
  unreachable: { label: "Unreachable", dot: "bg-danger", chip: "bg-elevated text-danger" },
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
    if (!res.ok) return { ok: false, message: tr("The server answered with status {status}. Is that a streaming server?", { status: res.status }) };
    const ms = Math.max(1, Math.round(performance.now() - started));
    return { ok: true, message: tr("Server reachable in {ms}ms. Harbor will use it for torrent streaming.", { ms }) };
  } catch {
    return { ok: false, message: tr("Could not reach the server within 1.5 seconds. Check the address and that the server machine is online.") };
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
    <Section
      title={t("Remote streaming server")}
      subtitle={t(
        "Point Harbor at a streaming server on another machine, like the Stremio service on a home server. Torrents download and stream from that machine instead of this one.",
      )}
    >
      <SettingGroup label={t("Connection")}>
        <SettingRow
          wide
          label={
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0">{t("Server address")}</span>
              <span className={`${BADGE_BASE} gap-1.5 ${pill.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {t(pill.label)}
              </span>
            </span>
          }
          desc={t("The address of the streaming server, including its port.")}
        >
          <span className="flex w-full flex-wrap items-center gap-2.5">
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
              aria-label={t("Server address")}
              className={FIELD}
            />
            {saved && (
              <button
                type="button"
                onClick={() => update({ remoteStreamServerUrl: "" })}
                className={ROW_ACTION}
              >
                {t("Forget")}
              </button>
            )}
          </span>
        </SettingRow>

        {saved && (
          <ToggleRow
            label={t("Use exclusively (never fall back to local)")}
            sub={t("If the server is unreachable, playback fails instead of streaming locally. Use this when your VPN runs on the server machine and torrent traffic must never leave this one.")}
            value={settings.remoteStreamServerStrict}
            onChange={(v) => update({ remoteStreamServerStrict: v })}
          />
        )}

        {saved && (
          <SettingRow
            label={t("Test connection")}
            desc={t("Probes the server's settings endpoint from this device and reports what came back.")}
          >
            <button
              type="button"
              onClick={testing ? undefined : () => void test()}
              aria-disabled={testing}
              className={`${ROW_ACTION}${testing ? " pointer-events-none opacity-45" : ""}`}
            >
              {testing ? (
                <Loader2 size={16} strokeWidth={1.9} className="animate-spin" />
              ) : (
                <Wifi size={16} strokeWidth={1.9} />
              )}
              {testing ? t("Testing") : t("Run test")}
            </button>
          </SettingRow>
        )}

        {saved && result && (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
            <span
              className={`mt-[2px] shrink-0 ${result.ok ? "text-success" : "text-danger"}`}
            >
              {result.ok ? <Check size={18} strokeWidth={2.4} /> : <X size={18} strokeWidth={2.4} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={`text-[16.5px] font-medium leading-[24px] ${
                  result.ok ? "text-ink" : "text-danger"
                }`}
              >
                {result.ok ? t("Server reachable") : t("Test failed")}
              </span>
              <span className={`max-w-[66ch] ${ROW_DESC}`}>{result.message}</span>
            </span>
          </div>
        )}
      </SettingGroup>
    </Section>
  );
}
