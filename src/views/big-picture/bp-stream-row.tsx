import type { CSSProperties } from "react";
import {
  ArrowDownToLine,
  Check,
  Download,
  ExternalLink,
  HardDrive,
  History,
  Loader2,
  Share2,
} from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { AddonLogo } from "@/components/addon-logo";
import { LocalVersionBadges } from "@/components/local-version-badges";
import { MediaServerBrand } from "@/components/media-server-brand";
import { MediaServerVersionBadges } from "@/components/media-server-version-badges";
import { DubSubPill, streamDubSub } from "@/components/dub-sub-pill";
import { FlagStack } from "@/components/flag";
import {
  FormatBadge,
  RuleBadges,
  qualityConfidence,
  streamBadges,
} from "@/components/format-badge";
import { HostMatchChip } from "@/components/host-match-chip";
import { QUALITY_LABEL, qualityKey } from "@/components/player/stream-switcher/quality";
import type { LocalEntry } from "@/lib/local-library";
import type { MediaServerConnection, PlayableCopy } from "@/lib/media-server/types";
import type { MediaServerHealth } from "@/lib/media-server/health";
import { episodeLabel } from "@/lib/local-library/player-src";
import { useSettings } from "@/lib/settings";
import { formatBytes } from "@/lib/together/source-descriptor";
import { SFX } from "@/lib/sfx";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import {
  contributorLabel,
  displayTitle,
  streamSummaryParts,
  torrentFilename,
} from "@/views/play-picker/picker-utils";
import { useBpT } from "./bp-i18n";

const LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

const ROW =
  "group flex w-full gap-[clamp(12px,1.2vw,22px)] rounded-[var(--bp-r-md)] border bg-[var(--bp-panel)] px-[clamp(14px,1.3vw,24px)] py-[clamp(11px,1.4vh,20px)] text-start data-[bp-focus=true]:bg-[var(--bp-panel-2)] data-[bp-focus=true]:shadow-[0_1px_0_0_color-mix(in_oklab,var(--color-ink)_22%,transparent)_inset,0_18px_40px_-16px_rgba(0,0,0,0.9)]";

const SLOT = "flex shrink-0 items-center justify-center bg-[var(--bp-glass)]";

const ACTION = `${SLOT} h-[clamp(44px,5vh,58px)] w-[clamp(44px,5vh,58px)] rounded-full`;

const META = "flex flex-wrap items-center gap-[clamp(5px,0.5vw,10px)]";

const PILL_BASE =
  "flex shrink-0 items-center gap-[clamp(4px,0.4vw,7px)] rounded-full border px-[clamp(9px,0.8vw,15px)] py-[clamp(4px,0.5vh,8px)] text-[clamp(11px,1.45vh,16px)] font-bold";

const PILL = `${PILL_BASE} border-[var(--bp-edge)] text-ink-muted`;

const PILL_STATE = `${PILL_BASE} border-[var(--bp-edge-2)] uppercase tracking-[0.12em] text-ink`;

const TAG = "text-[clamp(11px,1.45vh,16px)] font-bold uppercase tracking-[0.13em] text-ink-muted";

function editionText(edition: string): string {
  if (/director/i.test(edition)) return "Director's Cut";
  if (/open[\s.]?matte/i.test(edition)) return "Open Matte";
  return edition;
}

// AIOStreams and most of its peers prefix every line of a description with a
// coloured pictograph, and the headline often carries one too. Rendered raw that
// is six to eight saturated glyphs per row on three visible rows, which on a
// near black canvas is the loudest thing on the sources page and the whole of
// what "too harsh" means here. The words after them already carry the meaning,
// so this drops the glyph and keeps the sentence.
// Escapes, never the literal characters. The last three are invisible in a
// source file and an editor that normalises them silently breaks the strip.
// Skin tone, VS16, ZWJ and the keycap are each outside Extended_Pictographic,
// so dropping them leaves an invisible orphan behind the removed glyph.
const PICTOGRAPH =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

function plainLine(text: string): string {
  return text
    .replace(PICTOGRAPH, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detailLine(description: string, summary: string[], headline: string): string {
  const seen = new Set([headline]);
  const parts = [...summary];
  for (const raw of description.split("\n")) {
    const line = plainLine(raw);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
  }
  return parts.join(" · ");
}

export function BpLocalRow({
  entry,
  autofocus,
  onPick,
}: {
  entry: LocalEntry;
  autofocus?: boolean;
  onPick: () => void;
}) {
  const t = useBpT();
  const ep = episodeLabel(entry);

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      style={LIFT}
      onClick={() => {
        SFX.click();
        onPick();
      }}
      aria-label={`${t("Local Library")} ${entry.filename}`}
      className={`${ROW} items-center border-transparent text-ink`}
    >
      <span
        className={`${SLOT} h-[clamp(46px,5.2vh,64px)] w-[clamp(46px,5.2vh,64px)] rounded-[var(--bp-r-sm)]`}
      >
        <HardDrive size={21} strokeWidth={2} className="text-[var(--bp-live)]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(3px,0.4vh,7px)]">
        <span className={`${META} ${TAG}`}>
          {t("Local Library")}
          {ep && <span className="tracking-normal">{ep}</span>}
          <LocalVersionBadges entry={entry} size="md" showSize={false} />
        </span>
        <span className="line-clamp-1 text-[clamp(12.5px,1.65vh,18px)] font-medium leading-snug text-ink-muted [overflow-wrap:anywhere]">
          {entry.filename}
        </span>
        {entry.size != null && (
          <span className="text-[clamp(11.5px,1.5vh,17px)] font-medium tabular-nums text-ink-subtle">
            {formatBytes(entry.size)}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] self-center">
        <span className={PILL}>
          <HardDrive size={14} strokeWidth={2.4} />
          {t("Local")}
        </span>
        <span className={ACTION}>
          <Play size={19} className="fill-current" strokeWidth={0} />
        </span>
      </span>
    </button>
  );
}

export function BpHomeServerRow({
  copy,
  connection,
  status,
  unavailable,
  autofocus,
  onPick,
}: {
  copy: PlayableCopy;
  connection: MediaServerConnection;
  status: MediaServerHealth;
  unavailable?: boolean;
  autofocus?: boolean;
  onPick: () => void;
}) {
  const t = useBpT();
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      disabled={unavailable}
      style={LIFT}
      onClick={() => {
        SFX.click();
        onPick();
      }}
      aria-label={`${connection.name} ${copy.label}`}
      className={`${ROW} items-center border-transparent text-ink disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <span
        className={`${SLOT} h-[clamp(46px,5.2vh,64px)] w-[clamp(46px,5.2vh,64px)] rounded-[var(--bp-r-sm)]`}
      >
        <MediaServerBrand provider={connection.provider} name={connection.name} compact />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(3px,0.4vh,7px)]">
        <span className={META}>
          <span className={TAG}>{connection.name}</span>
          <MediaServerVersionBadges
            version={copy.version}
            filename={copy.label}
            size="md"
            showSize={false}
          />
        </span>
        <span className="line-clamp-1 text-[clamp(12.5px,1.65vh,18px)] font-medium leading-snug text-ink-muted [overflow-wrap:anywhere]">
          {copy.label}
        </span>
        {copy.version.sizeBytes != null && (
          <span className="text-[clamp(11.5px,1.5vh,17px)] font-medium tabular-nums text-ink-subtle">
            {formatBytes(copy.version.sizeBytes)}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] self-center">
        <span className={PILL}>
          <MediaServerBrand provider={connection.provider} name={connection.name} />
        </span>
        {unavailable && (
          <span className={PILL_STATE}>
            {status === "checking" ? t("Checking…") : t("Offline")}
          </span>
        )}
        <span className={ACTION}>
          <Play size={19} className="fill-current" strokeWidth={0} />
        </span>
      </span>
    </button>
  );
}

export function BpStreamRow({
  stream,
  logo,
  cachedOn,
  cached,
  isAnime,
  isCurrent,
  remembered,
  resolving,
  failed,
  hostMatch,
  showName,
  episode,
  autofocus,
  download,
  onPick,
}: {
  stream: ScoredStream;
  logo: string | null;
  cachedOn: { name: string; owned: boolean } | null;
  cached: boolean;
  isAnime: boolean;
  isCurrent: boolean;
  remembered: boolean;
  resolving: boolean;
  failed: boolean;
  hostMatch: "same" | "close" | null;
  showName: string;
  episode?: PlayEpisode;
  autofocus?: boolean;
  download?: boolean;
  onPick: () => void;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const confidence = qualityConfidence(stream);
  const quality =
    confidence === "unlabeled"
      ? t("No Label")
      : confidence === "unverified"
        ? t("Unverified")
        : QUALITY_LABEL[qualityKey(stream)];
  const addonName = contributorLabel(stream) || stream.addonId;
  const headline = plainLine(displayTitle(stream, showName, episode) || addonName);
  const rawDescription = stream.title?.trim() || stream.description?.trim() || "";
  const fullDescription = rawDescription.split("\n").map(plainLine).filter(Boolean).join("\n");
  const filename = settings.pickerShowFilename ? torrentFilename(stream) : "";
  const badges = settings.showQualityBadge ? streamBadges(stream) : [];
  const dubSub = settings.showDubBadge ? streamDubSub(stream.audioLanguages, isAnime) : null;
  const languages = stream.audioLanguages.filter((l) => l.toLowerCase() !== "unknown");
  const detail = detailLine(rawDescription, streamSummaryParts(stream), headline);
  const external = !stream.url && !stream.infoHash && Boolean(stream.externalUrl || stream.ytId);
  const p2p = !cached && !external && stream.infoHash != null;
  const needsCache = !cached && !external && !stream.url && stream.infoHash == null;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      style={LIFT}
      onClick={() => {
        SFX.click();
        onPick();
      }}
      aria-label={`${download ? t("Download") : t("Play")} ${quality} ${headline}`}
      className={`${ROW} items-stretch text-ink ${
        failed
          ? "border-[var(--bp-edge)] opacity-70"
          : isCurrent
            ? "border-[var(--bp-edge-2)]"
            : "border-transparent"
      }`}
    >
      <span
        className={`${SLOT} h-[clamp(46px,5.2vh,64px)] w-[clamp(46px,5.2vh,64px)] overflow-hidden rounded-[var(--bp-r-sm)]`}
      >
        <AddonLogo
          addonId={stream.addonId}
          addonName={stream.addonName ?? stream.addonId}
          manifestLogo={logo}
          size="tile"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(4px,0.5vh,8px)]">
        <span className={META}>
          {settings.showQualityBadge && (
            <span className="shrink-0 rounded-[var(--bp-r-xs)] bg-[var(--bp-glass)] px-[clamp(8px,0.7vw,13px)] py-[2px] text-[clamp(12.5px,1.7vh,19px)] font-extrabold tracking-[0.01em] text-ink">
              {quality}
            </span>
          )}
          <span className={`max-w-[clamp(120px,13vw,240px)] truncate ${TAG}`}>{addonName}</span>
          <HostMatchChip match={hostMatch} />
          {dubSub && <DubSubPill kind={dubSub} size="md" />}
          {badges.map((b) => (
            <FormatBadge key={b} kind={b} size="md" />
          ))}
          <RuleBadges stream={stream} size="md" />
          {stream.edition && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--bp-glass)] px-[clamp(8px,0.7vw,13px)] py-[3px] text-[clamp(10.5px,1.35vh,15px)] font-bold uppercase tracking-[0.12em] text-ink-muted">
              {editionText(stream.edition)}
            </span>
          )}
          {languages.length > 0 && <FlagStack languages={languages} max={4} size="md" />}
        </span>

        <span className="line-clamp-2 text-[clamp(14.5px,2.05vh,24px)] font-semibold leading-snug [overflow-wrap:anywhere]">
          {headline}
        </span>

        {settings.fullStreamDescription && fullDescription ? (
          <span className="whitespace-pre-line text-[clamp(12px,1.65vh,18px)] font-medium leading-snug text-ink-muted [overflow-wrap:anywhere]">
            {fullDescription}
          </span>
        ) : (
          detail && (
            <span className="line-clamp-1 text-[clamp(12px,1.65vh,18px)] font-medium text-ink-muted [overflow-wrap:anywhere]">
              {detail}
            </span>
          )
        )}

        {filename && filename !== headline && (
          <span className="line-clamp-1 font-mono text-[clamp(11px,1.45vh,16px)] leading-snug text-ink-subtle [overflow-wrap:anywhere]">
            {filename}
          </span>
        )}

        {failed && (
          <span className="text-[clamp(12px,1.6vh,18px)] font-bold text-ink">
            {t("Unavailable, try another.")}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] self-center">
        {isCurrent ? (
          <span className={PILL_STATE}>{t("Now playing")}</span>
        ) : remembered ? (
          <span className={PILL}>
            <History size={14} strokeWidth={2.4} />
            {t("Played last")}
          </span>
        ) : null}
        {cached ? (
          <span className="flex shrink-0 items-center gap-[clamp(5px,0.45vw,8px)] text-[clamp(11.5px,1.5vh,17px)] font-bold text-ink">
            <Check size={16} strokeWidth={3} className="text-[var(--bp-live)]" />
            {cachedOn
              ? cachedOn.owned
                ? t("In {name}", { name: cachedOn.name })
                : t("Cached on {name}", { name: cachedOn.name })
              : t("Cached")}
          </span>
        ) : external ? (
          <span className={PILL}>
            <ExternalLink size={14} strokeWidth={2.4} />
            {t("External")}
          </span>
        ) : p2p ? (
          <span className={PILL}>
            <Share2 size={14} strokeWidth={2.4} />
            {t("P2P")}
          </span>
        ) : needsCache ? (
          <span className={PILL}>
            <Download size={14} strokeWidth={2.4} />
            {t("Cache")}
          </span>
        ) : null}
        <span className={ACTION}>
          {resolving ? (
            <Loader2
              size={19}
              className="animate-spin motion-reduce:[animation-duration:2.4s]"
              strokeWidth={2.4}
            />
          ) : download ? (
            <ArrowDownToLine size={19} strokeWidth={2.2} />
          ) : external ? (
            <ExternalLink size={19} strokeWidth={2.2} />
          ) : (
            <Play size={19} className="fill-current" strokeWidth={0} />
          )}
        </span>
      </span>
    </button>
  );
}
