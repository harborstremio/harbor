import { Check, Laptop, Monitor, Smartphone, Tv } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { usePairedHarbors } from "@/lib/lan-trust";
import {
  themeSwatch,
  type HarborDeviceState,
  type HarborInstance,
  type HarborTrust,
} from "./play-on-lan";

export function usePairedIds(): ReadonlySet<string> {
  const rows = usePairedHarbors();
  return useMemo(() => new Set(rows.map((row) => row.peerId)), [rows]);
}

export function lanTrustOf(peerId: string, paired: ReadonlySet<string>): HarborTrust {
  return paired.has(peerId) ? "paired" : "pairable";
}

const LEAVE_MS = 260;
const STAGGER_MS = 65;

export type RosterEntry = { instance: HarborInstance; leaving: boolean; stagger: number };

function reconcile(
  prev: RosterEntry[],
  peers: HarborInstance[],
  settled: boolean,
): RosterEntry[] {
  const live = new Map(peers.map((p) => [p.id, p]));
  const kept = new Set<string>();
  const out: RosterEntry[] = [];
  for (const entry of prev) {
    const now = live.get(entry.instance.id);
    kept.add(entry.instance.id);
    if (now) {
      out.push({ instance: now, leaving: false, stagger: entry.stagger });
      continue;
    }
    if (!settled) {
      out.push(entry);
      continue;
    }
    out.push({ ...entry, leaving: true });
  }
  let fresh = 0;
  for (const peer of peers) {
    if (kept.has(peer.id)) continue;
    out.push({ instance: peer, leaving: false, stagger: fresh });
    fresh += 1;
  }
  return out;
}

function sameRoster(a: RosterEntry[], b: RosterEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => {
    const other = b[i];
    return (
      entry.instance === other.instance &&
      entry.leaving === other.leaving &&
      entry.stagger === other.stagger
    );
  });
}

export function useDeviceRoster(peers: HarborInstance[], settled: boolean): RosterEntry[] {
  const [entries, setEntries] = useState<RosterEntry[]>([]);

  useEffect(() => {
    setEntries((prev) => {
      const next = reconcile(prev, peers, settled);
      return sameRoster(prev, next) ? prev : next;
    });
  }, [peers, settled]);

  useEffect(() => {
    if (!entries.some((entry) => entry.leaving)) return;
    const id = window.setTimeout(() => {
      setEntries((cur) => (cur.some((e) => e.leaving) ? cur.filter((e) => !e.leaving) : cur));
    }, LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [entries]);

  return entries;
}

export function ListeningPulse({ active }: { active: boolean }) {
  return (
    <span
      className="relative flex size-4 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      {active ? (
        <>
          <span
            className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:hidden"
            style={{ animationDuration: "1800ms" }}
          />
          <span
            className="absolute inset-0 animate-ping rounded-full bg-accent/[0.18] motion-reduce:hidden"
            style={{ animationDuration: "1800ms", animationDelay: "900ms" }}
          />
        </>
      ) : null}
      <span
        className={`size-1.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-ink-subtle"} motion-reduce:transition-none`}
      />
    </span>
  );
}

function PlatformGlyph({ platform, size }: { platform: string; size: number }) {
  const stroke = 1.9;
  if (platform === "android" || platform === "ios") return <Tv size={size} strokeWidth={stroke} />;
  if (platform === "macos") return <Laptop size={size} strokeWidth={stroke} />;
  if (platform === "windows" || platform === "linux")
    return <Monitor size={size} strokeWidth={stroke} />;
  return <Smartphone size={size} strokeWidth={stroke} />;
}

function ThemeTile({
  platform,
  theme,
  done,
}: {
  platform: string;
  theme: string | null | undefined;
  done: boolean;
}) {
  const swatch = useMemo(() => themeSwatch(theme), [theme]);
  const glyph = done ? (
    <Check size={19} strokeWidth={2.4} />
  ) : (
    <PlatformGlyph platform={platform} size={19} />
  );
  if (done || !swatch) {
    return (
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
          done ? "bg-accent-soft text-accent" : "bg-elevated text-ink-muted"
        }`}
      >
        {glyph}
      </span>
    );
  }
  return (
    <span
      className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-edge-soft"
      style={{ background: `linear-gradient(155deg, ${swatch[1]}, ${swatch[0]})`, color: swatch[2] }}
    >
      {glyph}
      <span
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: swatch[2], opacity: 0.6 }}
      />
    </span>
  );
}

const DOT: Record<HarborDeviceState, string> = {
  self: "bg-accent",
  paired: "bg-success",
  ready: "bg-success",
  pairable: "bg-accent",
  checking: "bg-ink-subtle",
  "remote-off": "bg-ink-subtle",
  unreachable: "bg-danger",
};

function StatePill({
  dot,
  label,
  danger,
  pulse,
}: {
  dot: string;
  label: string;
  danger: boolean;
  pulse: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canvas/55 px-2 py-[3px]">
      <span
        className={`size-1.5 rounded-full ${dot} ${pulse ? "animate-pulse motion-reduce:animate-none" : ""}`}
      />
      <span className={`text-[11px] font-medium ${danger ? "text-danger" : "text-ink-muted"}`}>
        {label}
      </span>
    </span>
  );
}

export type CardStatus =
  | { kind: "busy"; text: string }
  | { kind: "done"; text: string }
  | { kind: "failed"; text: string };

export type HarborDeviceCardProps = {
  name: string;
  platform: string;
  detail: string;
  theme?: string | null;
  state: HarborDeviceState;
  note?: string;
  status?: CardStatus;
  stagger?: number;
  leaving?: boolean;
  onActivate?: () => void;
  activateLabel?: string;
  actions?: React.ReactNode;
};

function useEntered(delayMs: number): boolean {
  const [entered, setEntered] = useState(false);
  const frame = useRef(0);
  useEffect(() => {
    const id = window.setTimeout(() => {
      frame.current = window.requestAnimationFrame(() => setEntered(true));
    }, delayMs);
    return () => {
      window.clearTimeout(id);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [delayMs]);
  return entered;
}

export function HarborDeviceCard({
  name,
  platform,
  detail,
  theme,
  state,
  note,
  status,
  stagger = 0,
  leaving = false,
  onActivate,
  activateLabel,
  actions,
}: HarborDeviceCardProps) {
  const t = useT();
  const entered = useEntered(leaving ? 0 : Math.min(stagger, 5) * STAGGER_MS);
  const open = entered && !leaving;

  const pill: Record<HarborDeviceState, string> = {
    self: t("This device"),
    paired: t("Paired"),
    ready: t("Ready"),
    pairable: t("Needs pairing"),
    checking: t("Checking"),
    "remote-off": t("Remote off"),
    unreachable: t("Unreachable"),
  };

  const reason: Partial<Record<HarborDeviceState, string>> = {
    pairable: t("Pair once from here and this Harbor will take commands."),
    "remote-off": t("Remote control is off on that Harbor, so it cannot be driven from here."),
    unreachable: t("That Harbor is on the network but is not answering, so it cannot be driven."),
  };

  const blocked = state === "remote-off" || state === "unreachable";
  const busy = status?.kind === "busy";
  const done = status?.kind === "done";
  const failed = status?.kind === "failed";
  const locked = blocked || busy || done;
  const line = status ? status.text : detail;
  const why = note ?? (status ? undefined : reason[state]);

  const pillLabel = busy
    ? t("Sending")
    : done
      ? t("Sent")
      : failed
        ? t("Could not send")
        : pill[state];
  const pillDot = busy ? "bg-ink-subtle" : done ? "bg-success" : failed ? "bg-danger" : DOT[state];

  const body = (
    <>
      <ThemeTile platform={platform} theme={theme} done={done} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`truncate text-[14px] font-semibold ${blocked ? "text-ink-muted" : "text-ink"}`}
          >
            {name}
          </span>
          <StatePill
            dot={pillDot}
            label={pillLabel}
            danger={failed || state === "unreachable"}
            pulse={busy || state === "checking"}
          />
        </span>
        <span
          className={`truncate text-[12px] ${failed ? "text-danger" : "text-ink-muted"}`}
        >
          {line}
        </span>
        {why ? (
          <span className="text-[11.5px] leading-relaxed text-ink-subtle">{why}</span>
        ) : null}
      </span>
    </>
  );

  const shell = `flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-start ${
    state === "self"
      ? "border-accent/40 bg-accent/[0.05]"
      : blocked
        ? "border-edge-soft bg-canvas/20"
        : "border-edge bg-canvas/40"
  }`;
  const hover = locked ? "" : "hover:border-edge hover:bg-elevated/55";

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] ${
        leaving ? "duration-[260ms]" : "duration-[420ms]"
      } ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} motion-reduce:transition-none`}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <div className="overflow-hidden">
        <div
          className={`flex items-stretch gap-1.5 transition-transform ${
            leaving ? "duration-[260ms]" : "duration-[420ms]"
          } ${open ? "translate-y-0" : "translate-y-1.5"} motion-reduce:transition-none`}
          style={{ transitionTimingFunction: "var(--ease-out)" }}
        >
          {onActivate ? (
            <button
              type="button"
              onClick={onActivate}
              disabled={locked}
              aria-label={activateLabel ? `${activateLabel}: ${name}` : name}
              className={`${shell} ${hover} min-h-[68px] flex-1 transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none`}
            >
              {body}
            </button>
          ) : (
            <div className={`${shell} flex-1`}>{body}</div>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

export function TrustAction({
  label,
  hint,
  loud,
  onClick,
}: {
  label: string;
  hint: string;
  loud: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={hint}
      className={`flex h-11 shrink-0 items-center self-center rounded-xl px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
        loud
          ? "bg-accent text-canvas hover:opacity-90"
          : "border border-edge text-ink-muted hover:bg-elevated hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
