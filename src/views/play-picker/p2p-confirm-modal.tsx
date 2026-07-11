import type { Meta } from "@/lib/cinemeta";
import type { ScoredStream } from "@/lib/streams/types";
import { Radio, Users, X } from "lucide-react";
import { useState } from "react";

import { formatSize, streamSummaryParts } from "./picker-utils";

export function P2pConfirmModal({
  meta,
  stream,
  onConfirm,
  onCancel,
}: {
  meta: Meta;
  stream: ScoredStream;
  onConfirm: (remember: boolean) => void;
  onCancel: () => void;
}) {
  const [remember, setRemember] = useState(false);
  const backdrop = meta.background || meta.poster;
  const title = stream.parsedTitle || stream.title || stream.name || "This source";
  const summary = streamSummaryParts(stream).filter((p) => !/seed/i.test(p));
  return (
    <main className="fixed inset-0 z-[120] overflow-hidden bg-black">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[28px] saturate-150"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="max-w-2xl font-display text-[40px] font-medium leading-[1.06] text-white">
          Stream this via peer-to-peer?
        </h1>
        <p className="max-w-xl text-[14.5px] leading-relaxed text-white/75">
          This source isn&apos;t cached on your debrid, so Harbor would pull it directly from peers. It can take a
          moment to start and may buffer on low-seed torrents.
        </p>
        <div className="flex max-w-xl flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5">
          <span className="line-clamp-2 font-mono text-[13px] text-white/90">{title}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-white/60">
            {stream.seeders != null && (
              <span className="flex items-center gap-1.5 text-white/80">
                <Users size={12} strokeWidth={2.2} />
                {stream.seeders} seeders
              </span>
            )}
            {stream.size != null && <span>{formatSize(stream.size)}</span>}
            {summary.length > 0 && <span>{summary.join(" · ")}</span>}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/70 transition-colors hover:text-white/90">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Auto-play peer-to-peer sources from now on
        </label>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onConfirm(remember)}
            className="flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Radio size={15} strokeWidth={2.4} />
            Stream via P2P
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 text-[14px] font-medium text-white/75 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <X size={15} strokeWidth={2.2} />
            Back to sources
          </button>
        </div>
      </div>
    </main>
  );
}
