import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getCacheReports,
  getSamples,
  startProfiler,
  stopProfiler,
  subscribeProfiler,
  type Sample,
} from "@/lib/memory-profiler";
import { getNativeMem, getRamTier } from "@/lib/native-memory";

const STORAGE_KEY = "harbor.memoryHud.open";

export function MemoryHud() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [, force] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    startProfiler();
    const unsub = subscribeProfiler(() => force((x) => x + 1));
    return () => {
      unsub();
      stopProfiler();
    };
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {}
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const api = window.__harborProfiler;
  if (!api) return null;
  const heap = api.getHeapMB();
  const baseline = api.getBaselineMB();
  const peak = api.getPeakMB();
  const netMB = api.getNetworkMB();
  const delta = heap - baseline;
  const caches = getCacheReports().slice(0, 12);
  const samples = getSamples();
  const recent = samples.slice(-8).reverse();
  const heapColor = delta > 200 ? "#ff7676" : delta > 100 ? "#ffb866" : "#7eb6ff";

  return (
    <div
      className="fixed bottom-3 end-3 z-[9999] flex w-[400px] flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/95 p-3 font-mono text-[11px] text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink">PROFILER</span>
          <span style={{ color: heapColor }}>{heap.toFixed(1)}MB</span>
          <span className="text-ink-subtle">
            (Δ{delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} · peak {peak.toFixed(1)})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => api.reset()}
            className="rounded px-2 py-0.5 text-[10px] text-ink-muted hover:bg-elevated hover:text-ink"
            title="Reset baseline"
          >
            reset
          </button>
          <button
            type="button"
            onClick={() => {
              const r = api.dumpReport();
              if (r) {
                setToast(
                  `Downloaded ${r.filename} (${r.events} events, ${(r.bytes / 1024).toFixed(1)} KB)`,
                );
                setTimeout(() => setToast(null), 4000);
              }
            }}
            className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/30"
            title="Download full report as a .txt file"
          >
            dump
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-0.5 text-ink-muted hover:bg-elevated hover:text-ink"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              try {
                localStorage.setItem(STORAGE_KEY, "0");
              } catch {}
            }}
            className="rounded p-0.5 text-ink-muted hover:bg-elevated hover:text-ink"
            title="Close (Ctrl+Shift+M to reopen)"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <NativeLine />
      {!collapsed && (
        <>
          <DomLine />
          <NetLine netMB={netMB} />
          {caches.length > 0 && <CacheTable caches={caches} />}
          <EventList samples={recent} />
        </>
      )}
      {toast && (
        <div className="rounded bg-accent/25 px-2 py-1 text-[10px] font-medium text-accent">
          {toast}
        </div>
      )}
    </div>
  );
}

function NativeLine() {
  const m = getNativeMem();
  const tier = getRamTier();
  if (m.total <= 0) return null;
  const color = m.total > 1800 ? "#ff7676" : m.total > 1200 ? "#ffb866" : "#7eea9f";
  return (
    <div className="flex items-center justify-between gap-2 border-t border-edge-soft pt-1.5">
      <span className="font-bold text-ink">RSS</span>
      <span>
        <span style={{ color }}>{m.total.toFixed(0)}MB</span>
        <span className="text-ink-subtle">
          {" "}
          · hb {m.harborRss.toFixed(0)} · wv {m.webviewRss.toFixed(0)} · {tier}
        </span>
      </span>
    </div>
  );
}

function DomLine() {
  const nodes = document.getElementsByTagName("*").length;
  const imgs = document.images.length;
  const vids = document.getElementsByTagName("video").length;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-edge-soft pt-1.5 text-ink-muted">
      <span>DOM</span>
      <span>
        {nodes} nodes · <span className="text-ink">{imgs} imgs</span> · {vids} vids
      </span>
    </div>
  );
}

function NetLine({ netMB }: { netMB: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-ink-muted">
      <span>NET</span>
      <span>{netMB.toFixed(2)} MB downloaded</span>
    </div>
  );
}

function CacheTable({ caches }: { caches: Array<{ name: string; size: number }> }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-edge-soft pt-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">Caches (top)</div>
      {caches.map((c) => (
        <div key={c.name} className="flex items-baseline justify-between gap-2">
          <span className="truncate text-ink-muted">{c.name}</span>
          <span className="text-ink">{c.size}</span>
        </div>
      ))}
    </div>
  );
}

function EventList({ samples }: { samples: Sample[] }) {
  if (samples.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 border-t border-edge-soft pt-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">Recent events</div>
      {samples
        .filter((s) => s.kind !== "tick")
        .map((s, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-[10px]">
            <span className="shrink-0 text-ink-subtle">[{s.kind}]</span>
            <span className="flex-1 truncate text-ink-muted">{s.label}</span>
            <span className="shrink-0 text-ink">{s.heapMB.toFixed(0)}MB</span>
          </div>
        ))}
    </div>
  );
}
