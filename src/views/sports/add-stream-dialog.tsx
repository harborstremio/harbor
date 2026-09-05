import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, ClipboardPaste, Link2, Loader2, Play, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import {
  fileNameOf,
  hostOf,
  normalizePageUrl,
  resolvePageStreams,
  type FoundVia,
  type ResolveFailure,
  type ResolveResult,
  type StreamCandidate,
  type StreamKind,
} from "@/lib/sports/stream-resolver";
import type { AttachedStream } from "./source-store";

type Phase =
  | { kind: "idle" }
  | { kind: "resolving"; host: string }
  | { kind: "done"; result: ResolveResult };

const KIND_LABEL: Record<StreamKind, string> = {
  hls: "HLS",
  dash: "DASH",
  file: "FILE",
};

function toAttached(candidate: StreamCandidate, result: ResolveResult): AttachedStream {
  return {
    url: candidate.url,
    kind: candidate.kind,
    headers: candidate.headers,
    page: result.pageUrl,
    title: result.title,
    poster: result.poster,
  };
}

export function useStreamPlayer(): (stream: AttachedStream, name: string) => void {
  const t = useT();
  const { openPlayer } = useView();
  return useCallback(
    (stream: AttachedStream, name: string) => {
      openPlayer({
        meta: {
          id: `page-stream:${stream.url}`,
          type: "tv",
          name,
          poster: stream.poster || undefined,
          background: stream.poster || undefined,
          description: t("Resolved from {host}", { host: hostOf(stream.page) }),
          releaseInfo: t("Live"),
        },
        url: stream.url,
        title: name,
        subtitle: hostOf(stream.page),
        notWebReady: true,
        isLive: stream.kind !== "file",
        headers: stream.headers,
      });
    },
    [openPlayer, t],
  );
}

function viaText(t: ReturnType<typeof useT>, via: FoundVia): string {
  switch (via) {
    case "direct":
      return t("Direct media link");
    case "element":
      return t("Video element");
    case "meta":
      return t("Page metadata");
    case "structured":
      return t("Structured data");
    case "config":
      return t("Player config");
    case "frame":
      return t("Embedded player");
    case "source":
      return t("Page source");
  }
}

function failureText(t: ReturnType<typeof useT>, failure: ResolveFailure | null): string {
  const status = failure?.status ?? 0;
  switch (failure?.code) {
    case "bad-url":
      return t("Enter a full http:// or https:// address.");
    case "unreachable":
      return t("Could not reach that page.");
    case "http-empty":
      return t("That page answered {status} and sent nothing back.", { status });
    case "empty":
      return t("That page sent back no readable content.");
    case "http-no-media":
      return t("That page answered {status}, so there was nothing to read.", { status });
    default:
      return t("No playable media was found in that page's source.");
  }
}

export function AddStreamDialog({
  onClose,
  fixtureLabel,
  onAttach,
}: {
  onClose: () => void;
  fixtureLabel?: string;
  onAttach?: (stream: AttachedStream) => void;
}) {
  const t = useT();
  const playStream = useStreamPlayer();
  const { closing, close } = useModalExit(onClose);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [picked, setPicked] = useState("");
  const runRef = useRef<AbortController | null>(null);

  useEffect(() => () => runRef.current?.abort(), []);

  const target = normalizePageUrl(input);

  const run = useCallback(async () => {
    const url = normalizePageUrl(input);
    if (!url) return;
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    setPicked("");
    setPhase({ kind: "resolving", host: hostOf(url) });
    const result = await resolvePageStreams(url, { signal: controller.signal });
    if (controller.signal.aborted) return;
    runRef.current = null;
    setPicked(result.candidates[0]?.url ?? "");
    setPhase({ kind: "done", result });
  }, [input]);

  const cancelRun = useCallback(() => {
    runRef.current?.abort();
    runRef.current = null;
    setPhase({ kind: "idle" });
  }, []);

  const paste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setInput(text.trim());
    } catch {}
  }, []);

  const result = phase.kind === "done" ? phase.result : null;
  const chosen = result?.candidates.find((c) => c.url === picked) ?? null;

  const play = () => {
    if (!chosen || !result) return;
    onClose();
    playStream(toAttached(chosen, result), fixtureLabel || result.title);
  };

  const attach = () => {
    if (!chosen || !result || !onAttach) return;
    onAttach(toAttached(chosen, result));
    onClose();
  };

  return (
    <ModalShell closing={closing} onDismiss={close} width={560}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Attach a stream")}
          </span>
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink">
            {fixtureLabel || t("Find a stream on a page")}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          aria-label={t("Cancel")}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <p className="rounded-lg bg-canvas/50 p-3.5 text-[12px] leading-relaxed text-ink-muted">
          {t(
            "Harbor opens only the address you paste here and lists the media it finds in that page's own source. It does not search anywhere else.",
          )}
        </p>

        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-canvas ps-3 pe-1 ring-1 ring-inset ring-edge-soft focus-within:ring-accent/50">
            <Link2 size={14} className="shrink-0 text-ink-subtle" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              placeholder={t("Paste the page address")}
              autoFocus
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-subtle"
            />
            <button
              type="button"
              onClick={paste}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              aria-label={t("Paste from clipboard")}
            >
              <ClipboardPaste size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={!target || phase.kind === "resolving"}
            className="harbor-press-pop h-10 shrink-0 rounded-lg bg-ink px-4 text-[12.5px] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {t("Find streams")}
          </button>
        </div>

        {phase.kind === "resolving" && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas/50 px-3.5 py-3">
            <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-muted">
              <Loader2 size={13} className="shrink-0 animate-spin" />
              <span className="truncate">{t("Reading {host}...", { host: phase.host })}</span>
            </span>
            <button
              type="button"
              onClick={cancelRun}
              className="shrink-0 text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
          </div>
        )}

        {result && result.candidates.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-lg bg-canvas/50 p-3.5">
            <CircleAlert size={14} className="mt-px shrink-0 text-ink-subtle" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12.5px] text-ink">{failureText(t, result.failure)}</span>
              <span className="truncate text-start text-[11px] text-ink-subtle">
                {result.pageUrl}
              </span>
            </div>
          </div>
        )}

        {result && result.candidates.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                {result.title}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">
                {t("{n} found", { n: result.candidates.length })}
              </span>
            </div>
            <div key={result.pageUrl} className="harbor-cascade flex flex-col gap-1">
              {result.candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.url}
                  candidate={candidate}
                  selected={candidate.url === picked}
                  label={viaText(t, candidate.via)}
                  onSelect={() => setPicked(candidate.url)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-6 pb-6">
        <button
          type="button"
          onClick={close}
          className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
        {onAttach && (
          <button
            type="button"
            onClick={attach}
            disabled={!chosen}
            className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            {t("Use for this fixture")}
          </button>
        )}
        <button
          type="button"
          onClick={play}
          disabled={!chosen}
          className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Play size={12} strokeWidth={2.6} />
          {t("Play now")}
        </button>
      </div>
    </ModalShell>
  );
}

function CandidateRow({
  candidate,
  selected,
  label,
  onSelect,
}: {
  candidate: StreamCandidate;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={candidate.url}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors duration-150 ${
        selected ? "bg-elevated ring-1 ring-edge" : "hover:bg-elevated/60"
      }`}
    >
      <span className="shrink-0 rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted ring-1 ring-inset ring-edge-soft">
        {KIND_LABEL[candidate.kind]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-start text-[12.5px] font-medium text-ink">
          {fileNameOf(candidate.url)}
        </span>
        <span className="truncate text-[11px] text-ink-subtle">
          {label} · {hostOf(candidate.url)}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">
        {Math.round(candidate.confidence * 100)}%
      </span>
      {selected ? (
        <span className="harbor-pop grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-canvas">
          <Check size={9} strokeWidth={3} />
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full bg-raised" />
      )}
    </button>
  );
}
