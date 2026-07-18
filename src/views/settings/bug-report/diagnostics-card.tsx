import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Diagnostics } from "@/lib/bug-report";

export function DiagnosticsCard({ diag }: { diag: Diagnostics | null }) {
  const [open, setOpen] = useState(false);
  if (!diag) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-edge-soft/55 bg-canvas/30 px-4 py-3 text-[12px] text-ink-subtle">
        Loading environment details…
      </div>
    );
  }
  const compact = `Harbor ${diag.appVersion} · ${diag.os}${diag.osVersion ? ` ${diag.osVersion}` : ""} · ${diag.viewport} · ${diag.locale}`;
  return (
    <div className="rounded-xl border border-edge-soft/55 bg-canvas/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-elevated text-ink-muted">
          <ShieldCheck size={14} strokeWidth={1.9} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[12px] font-semibold text-ink">What gets sent</span>
          <span className="truncate text-[11.5px] text-ink-subtle">{compact}</span>
        </div>
        <span className="ms-auto text-ink-subtle">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <div className="border-t border-edge-soft/55 px-4 py-3">
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-muted">
            Auto-included. No keys, no library, no URLs. Just structural flags so reproductions go
            faster.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] font-mono text-ink-muted">
            <Pair k="App" v={diag.appVersion} />
            <Pair k="OS" v={`${diag.os} ${diag.osVersion}`} />
            <Pair k="Viewport" v={diag.viewport} />
            <Pair k="Locale" v={diag.locale} />
            <Pair k="Player" v={diag.flags.playerEngine} />
            <Pair k="Region" v={diag.flags.region} />
            <Pair k="TMDB key" v={diag.flags.hasTmdb ? "yes" : "no"} />
            <Pair k="RPDB key" v={diag.flags.hasRpdb ? "yes" : "no"} />
            <Pair k="Trakt" v={diag.flags.hasTrakt ? "yes" : "no"} />
            <Pair k="Stremio" v={diag.flags.hasStremio ? "signed in" : "guest"} />
            <Pair k="Debrid keys" v={String(diag.flags.debridCount)} />
            <Pair k="Addons" v={String(diag.flags.addonCount)} />
            <Pair k="IPTV lists" v={String(diag.flags.iptvCount)} />
            <Pair k="Recent errors" v={String(diag.recentErrors.length)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-ink-subtle">{k}</span>
      <span className="truncate text-ink">{v || "n/a"}</span>
    </>
  );
}
