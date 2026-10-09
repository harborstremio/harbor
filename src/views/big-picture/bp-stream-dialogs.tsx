import { useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { exitBigPicture } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import type { ScoredStream } from "@/lib/streams/types";
import { useView, type PlayEpisode } from "@/lib/view";
import { formatSize, streamSummaryParts } from "@/views/play-picker/picker-utils";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

function useSeededFocus(ref: React.RefObject<HTMLButtonElement | null>, onBack: () => void) {
  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (ref.current) setBpFocus(ref.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, [ref]);

  useEffect(
    () =>
      pushBpBack(() => {
        onBack();
        return true;
      }),
    [onBack],
  );
}

function BpDialogShell({
  label,
  title,
  body,
  extra,
  children,
}: {
  label: string;
  title: string;
  body: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-label={label}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_80%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex w-[min(88vw,720px)] flex-col gap-[clamp(18px,2.4vh,32px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <div className="flex flex-col gap-[clamp(6px,0.9vh,13px)]">
          <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h2>
          <p className="text-[clamp(13px,1.8vh,20px)] leading-relaxed text-ink-subtle">{body}</p>
        </div>
        {extra}
        <div
          data-bp-row
          data-bp-scroll-x
          style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 100px" }}
          className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const BTN_BASE =
  "h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-[var(--bp-r-xs)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold";
const BTN_QUIET = `${BTN_BASE} border border-[var(--bp-edge-2)] text-ink`;
const BTN_LOUD = `${BTN_BASE} bg-[var(--bp-on)] text-ink`;

export function BpP2pDialog({
  stream,
  onConfirm,
  onCancel,
}: {
  stream: ScoredStream;
  onConfirm: (remember: boolean) => void;
  onCancel: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  useSeededFocus(seedRef, onCancel);
  const title = stream.parsedTitle || stream.title || stream.name || t("This source");
  const summary = streamSummaryParts(stream).filter((p) => !/seed/i.test(p));

  return (
    <BpDialogShell
      label={t("Stream this via peer-to-peer?")}
      title={t("Stream this via peer-to-peer?")}
      body={t(
        "This source isn't cached on your debrid, so Harbor would pull it directly from peers. It can take a moment to start and may buffer on low-seed torrents.",
      )}
      extra={
        <div className="flex flex-col gap-[clamp(6px,0.8vh,12px)] rounded-[var(--bp-r-sm)] border border-[var(--bp-edge)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] py-[clamp(12px,1.5vh,20px)]">
          <span className="line-clamp-2 font-mono text-[clamp(12.5px,1.7vh,19px)] text-ink [overflow-wrap:anywhere]">
            {title}
          </span>
          <span className="flex flex-wrap items-center gap-x-[clamp(10px,1vw,18px)] gap-y-1 text-[clamp(12px,1.6vh,18px)] font-medium text-ink-subtle">
            {stream.seeders != null && (
              <span className="flex items-center gap-1.5">
                <Users size={15} strokeWidth={2.2} />
                {t("{n} seeders", { n: stream.seeders })}
              </span>
            )}
            {stream.size != null && <span>{formatSize(stream.size)}</span>}
            {summary.length > 0 && <span>{summary.join(" · ")}</span>}
          </span>
        </div>
      }
    >
      <button
        ref={seedRef}
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus="true"
        onClick={() => {
          SFX.close();
          onCancel();
        }}
        className={BTN_QUIET}
      >
        {t("Cancel")}
      </button>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.click();
          onConfirm(false);
        }}
        className={BTN_LOUD}
      >
        {t("Stream")}
      </button>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.click();
          onConfirm(true);
        }}
        className={BTN_QUIET}
      >
        {t("Always stream P2P")}
      </button>
    </BpDialogShell>
  );
}

export function BpDebridDownDialog({
  onTryAgain,
  onBack,
}: {
  onTryAgain: () => void;
  onBack: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  useSeededFocus(seedRef, onBack);

  return (
    <BpDialogShell
      label={t("Debrid is down")}
      title={t("Your debrid service can't process this right now.")}
      body={t(
        "Real-Debrid, TorBox, AllDebrid and Premiumize all have brief outages where they stop returning links. Wait a few minutes and try again, or check the service's status page.",
      )}
    >
      <button
        ref={seedRef}
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus="true"
        onClick={() => {
          SFX.click();
          onTryAgain();
        }}
        className={BTN_LOUD}
      >
        {t("Try again")}
      </button>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.close();
          onBack();
        }}
        className={BTN_QUIET}
      >
        {t("Back")}
      </button>
    </BpDialogShell>
  );
}

export function BpNoSourcesDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useBpT();
  const { openSettings } = useView();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  useSeededFocus(seedRef, onClose);

  return (
    <BpDialogShell
      label={t("No streaming sources yet")}
      title={t("No streaming sources yet")}
      body={t(
        "Harbor needs at least one streaming source before it can play {title}. Install a stream addon or add a debrid key in settings.",
        { title },
      )}
    >
      <button
        ref={seedRef}
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus="true"
        onClick={() => {
          SFX.close();
          onClose();
        }}
        className={BTN_LOUD}
      >
        {t("Back")}
      </button>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.click();
          exitBigPicture();
          openSettings("streaming");
        }}
        className={BTN_QUIET}
      >
        {t("Leave Big Picture and open settings")}
      </button>
    </BpDialogShell>
  );
}

export function BpAutoExhaustedDialog({
  title,
  episode,
  triedCount,
  onBrowse,
  onBack,
}: {
  title: string;
  episode?: PlayEpisode;
  triedCount: number;
  onBrowse: () => void;
  onBack: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  useSeededFocus(seedRef, onBrowse);
  const label = episode
    ? `${title} S${episode.imdbSeason ?? episode.season}E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`
    : title;

  return (
    <BpDialogShell
      label={t("We could not find a working stream")}
      title={t("We could not find a working stream")}
      body={t(
        "Harbor tried {n} sources for {title} and none of them played. Usually that means a debrid key has expired, no stream addon is installed yet, or nothing has this title cached.",
        { n: triedCount, title: label },
      )}
    >
      <button
        ref={seedRef}
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus="true"
        onClick={() => {
          SFX.click();
          onBrowse();
        }}
        className={BTN_LOUD}
      >
        {t("Browse sources")}
      </button>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        onClick={() => {
          SFX.close();
          onBack();
        }}
        className={BTN_QUIET}
      >
        {t("Back")}
      </button>
    </BpDialogShell>
  );
}
