import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, Tv } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { isHydratableChannel } from "@/lib/iptv/channel-hydration";
import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import { findCurrent } from "@/lib/iptv/xmltv";
import { ChannelCard } from "./channel-card";
import { useChannelHydration } from "./hooks/use-channel-hydration";
import { useLazyVisible } from "./hooks/use-lazy-visible";

export function ChannelGrid({
  channels,
  onPlay,
  onInfo,
  epg,
  nowMs,
  resetKey,
}: {
  channels: IptvChannel[];
  onPlay: (ch: IptvChannel) => void;
  onInfo?: (meta: Meta) => void;
  epg: EpgIndex | null;
  nowMs: number;
  resetKey: string;
}) {
  const t = useT();
  const { visible, sentinelRef, hasMore } = useLazyVisible(channels, resetKey);
  const visibleNames = useMemo(
    () => visible.filter(isHydratableChannel).map((c) => c.name),
    [visible],
  );
  const hydrations = useChannelHydration(visibleNames);
  const tvgIdCounts = useMemo(() => computeTvgIdCounts(channels), [channels]);
  const nowMinute = Math.floor(nowMs / 60_000);
  const nowByChannel = useMemo(() => {
    const m = new Map<
      string,
      {
        current: ReturnType<typeof findCurrent>["current"];
        next: ReturnType<typeof findCurrent>["next"];
      }
    >();
    for (const ch of visible) {
      const programs = epgProgramsForChannel(ch, epg, tvgIdCounts);
      m.set(ch.id, findCurrent(programs, nowMs));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, epg, tvgIdCounts, nowMinute]);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
        {visible.map((ch) => {
          const { current, next } = nowByChannel.get(ch.id) ?? { current: null, next: null };
          const hydrated = hydrations.get(ch.name) ?? null;
          return (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onPlay={onPlay}
              onInfo={onInfo}
              current={current}
              next={next}
              now={nowMs}
              hydrated={hydrated}
            />
          );
        })}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="flex h-16 items-center justify-center">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-subtle" />
            {t("Loading more channels ({shown} of {total})", {
              shown: visible.length.toLocaleString(),
              total: channels.length.toLocaleString(),
            })}
          </div>
        </div>
      ) : channels.length > visible.length ? (
        <div className="mx-auto max-w-[460px] rounded-xl border border-edge-soft/55 bg-elevated/60 px-4 py-2.5 text-center text-[12px] text-ink-subtle">
          {t(
            "Showing first {shown} of {total} channels. Use search or a category to narrow down.",
            {
              shown: visible.length.toLocaleString(),
              total: channels.length.toLocaleString(),
            },
          )}
        </div>
      ) : (
        channels.length > 60 && (
          <div className="mx-auto rounded-xl border border-edge-soft/55 bg-elevated/60 px-4 py-2 text-[12px] text-ink-subtle">
            {t("All {total} channels loaded", { total: channels.length.toLocaleString() })}
          </div>
        )
      )}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  const classified = useMemo(() => classifyError(message), [message]);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(classified.raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div className="mx-auto mt-6 flex max-w-[560px] flex-col gap-5 rounded-2xl border border-danger/30 bg-elevated p-7">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
          <AlertTriangle size={20} strokeWidth={1.9} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-[17px] font-semibold leading-tight text-ink">
            {t(classified.title)}
          </h2>
          <p className="text-[13.5px] leading-snug text-ink-muted">{t(classified.hint)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRetry}
          className="flex h-10 items-center rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Try again")}
        </button>
        <button
          onClick={copy}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-edge-soft/55 bg-canvas/40 px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          {copied ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={1.9} />}
          {copied ? t("Copied") : t("Copy error")}
        </button>
      </div>
      <div className="border-t border-edge-soft/50 pt-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:text-ink-muted"
        >
          {expanded ? (
            <ChevronUp size={12} strokeWidth={2.2} />
          ) : (
            <ChevronDown size={12} strokeWidth={2.2} />
          )}
          {t("Technical details")}
        </button>
        {expanded && (
          <pre className="mt-2.5 max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas/70 p-3 font-mono text-[10.5px] leading-relaxed text-ink-subtle">
            {classified.raw}
          </pre>
        )}
      </div>
      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        {t(
          "Heads up: most IPTV providers cap how many streams an account can run at the same time. If other devices or players are using these credentials, close them and try again.",
        )}
      </p>
    </div>
  );
}

function classifyError(raw: string): { title: string; hint: string; raw: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("!doctype html") || lower.includes("<html")) {
    return {
      title: "Provider returned a webpage, not a playlist",
      hint: "Credentials are likely expired or the subscription is inactive. Edit the playlist URL above, or contact your provider.",
      raw,
    };
  }
  if (
    lower.includes("inactive") ||
    lower.includes("expired") ||
    lower.includes("banned") ||
    lower.includes("disabled")
  ) {
    return {
      title: "Account is not active",
      hint: "This Xtream account is expired, banned, or disabled on the provider side. Renew or confirm with your provider.",
      raw,
    };
  }
  if (lower.includes("auth failed") || lower.includes("rejected these credentials")) {
    return {
      title: "Xtream login was rejected",
      hint: "The server URL, username, or password is wrong. Edit the playlist and re-check the credentials your provider sent.",
      raw,
    };
  }
  if (lower.includes("non-json") || lower.includes("webpage instead")) {
    return {
      title: "Provider did not return valid data",
      hint: "The server replied with a webpage instead of Xtream data. The account may be expired, or the server URL is not an Xtream panel.",
      raw,
    };
  }
  if (lower.includes("401")) {
    return {
      title: "Bad username or password",
      hint: "The credentials in the URL are wrong. Edit the playlist and double check the username and password against what your provider sent.",
      raw,
    };
  }
  if (lower.includes("403")) {
    return {
      title: "Provider blocked the request",
      hint: "Your IP or device is blocked. Some providers geo restrict or limit how many devices can connect at once.",
      raw,
    };
  }
  if (lower.includes("404")) {
    return {
      title: "Playlist URL not found",
      hint: "The server responded but the playlist is not at that URL. Check for typos and verify with your provider.",
      raw,
    };
  }
  if (lower.includes("429")) {
    return {
      title: "Provider is rate limiting",
      hint: "Too many requests from your IP. Wait a minute and try again.",
      raw,
    };
  }
  if (
    lower.includes("503") ||
    lower.includes("max-connections") ||
    lower.includes("max connections")
  ) {
    return {
      title: "Provider refused service",
      hint: "Most common cause: this account is at its max simultaneous connections. Close other devices and players using these credentials.",
      raw,
    };
  }
  if (
    lower.includes("did not respond") ||
    lower.includes("gave up after") ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return {
      title: "Server did not respond",
      hint: "The playlist server is down or your network is blocking it. Try again in a few minutes.",
      raw,
    };
  }
  if (lower.includes("dns") || lower.includes("resolve") || lower.includes("name not resolved")) {
    return {
      title: "Could not resolve hostname",
      hint: "The URL hostname is wrong or no longer exists. Many providers rotate domains; ask your provider for an updated playlist URL.",
      raw,
    };
  }
  if (lower.includes("refused")) {
    return {
      title: "Connection refused",
      hint: "The playlist server actively refused the connection.",
      raw,
    };
  }
  if (lower.includes("reset")) {
    return {
      title: "Connection reset by server",
      hint: "The server rejected the request. Some providers block generic clients; verify the credentials work in their official app first.",
      raw,
    };
  }
  if (
    lower.includes("error sending request") ||
    lower.includes("tcp connect") ||
    lower.includes("unreachable")
  ) {
    return {
      title: "Could not reach playlist server",
      hint: "The host did not respond. The URL may have expired (many providers rotate domains), the server is down, or your network is blocking it. Contact your provider for an updated URL.",
      raw,
    };
  }
  if (lower.includes("empty body") || lower.includes("empty response")) {
    return {
      title: "Server returned an empty response",
      hint: "The server is reachable but is not sending any data. Check the URL or contact your provider.",
      raw,
    };
  }
  if (lower.includes("no channels")) {
    return {
      title: "Playlist contained no channels",
      hint: "The URL is valid but the playlist is empty. The provider may be in maintenance, or the URL is misconfigured.",
      raw,
    };
  }
  if (lower.includes("too large")) {
    return {
      title: "Playlist is too large",
      hint: "Harbor caps playlists at 80 MB to stay responsive. Most providers offer a filtered URL with fewer channels.",
      raw,
    };
  }
  return {
    title: "Could not load this playlist",
    hint: raw,
    raw,
  };
}

export function EmptyResult({ onClear }: { onClear: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center gap-3 py-16 text-center">
      <Tv size={26} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[16.5px] font-semibold text-ink">{t("No channels match")}</h2>
      <p className="text-[13.5px] text-ink-muted">
        {t("Try a different category or clear your filters.")}
      </p>
      <button
        onClick={onClear}
        className="mt-1 flex h-10 items-center rounded-xl border border-edge-soft bg-elevated px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        {t("Reset filters")}
      </button>
    </div>
  );
}
