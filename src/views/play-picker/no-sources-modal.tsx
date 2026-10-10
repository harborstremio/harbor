import type { Meta } from "@/lib/cinemeta";
import { useView } from "@/lib/view";

export function NoSourcesConfiguredModal({ meta }: { meta: Meta }) {
  const { goBack, setView, openSettings } = useView();
  const title = meta.name ?? "this title";
  return (
    <main className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black px-6">
      <div className="w-full max-w-md rounded-2xl bg-elevated p-8 ring-1 ring-edge-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-subtle">
          JL Media Vision
        </p>
        <h2 className="mt-3 text-[24px] font-semibold leading-tight text-ink">Set up a source</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          Nothing is set up that can search for {title} yet. Sources are tried in this order:
        </p>
        <ol className="mt-3 space-y-1.5 text-[13.5px] leading-relaxed text-ink-muted">
          <li>1. Your IPTV provider (M3U or Xtream), when it carries movies and shows.</li>
          <li>2. Real-Debrid, with your key in Settings.</li>
          <li>3. TorBox, with your key in Settings.</li>
        </ol>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-subtle">
          Stream addons you install are searched as well.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            onClick={() => setView("live")}
            className="flex h-11 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Add an IPTV provider
          </button>
          <button
            onClick={() => openSettings("streaming")}
            className="flex h-11 items-center justify-center rounded-full bg-elevated text-[13.5px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
          >
            Add a Real-Debrid or TorBox key
          </button>
          <button
            onClick={() => setView("addons")}
            className="flex h-11 items-center justify-center rounded-full bg-elevated text-[13.5px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
          >
            Browse addons
          </button>
          <button
            onClick={goBack}
            className="mt-1 text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
