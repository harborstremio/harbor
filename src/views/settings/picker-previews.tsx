import { ChevronDown, Play, Zap } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useHydratedPoster } from "@/lib/sample-artwork";
import poster1 from "@/assets/preview/poster1.webp";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-4">
      {children}
    </div>
  );
}

export function PickerLayoutPreview({ value }: { value: "condensed" | "stremio" }) {
  return <Shell>{value === "condensed" ? <CondensedMock /> : <StremioMock />}</Shell>;
}

function CondensedMock() {
  const poster = useHydratedPoster("tt15239678", poster1);
  return (
    <>
      <section className="relative overflow-hidden rounded-[20px] border border-edge-soft/70 bg-canvas/85">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/12 to-transparent" />
        <div className="grid grid-cols-[110px_1fr] gap-4 p-4">
          <div className="relative aspect-[2/3] overflow-hidden rounded-[12px] ring-1 ring-edge-soft/60">
            <img src={poster} alt="" draggable={false} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/65 to-transparent" />
            <div className="absolute end-1.5 top-1.5 flex flex-col items-end gap-1">
              <FormatBadge kind="4k-uhd" size="sm" />
              <FormatBadge kind="hdr" size="sm" />
              <FormatBadge kind="atmos" size="sm" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center rounded-full border border-edge-soft/70 bg-canvas/60 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                Audio not labeled
              </span>
              <p className="line-clamp-2 break-all font-mono text-[12px] leading-relaxed text-ink">
                Example.Movie.2024.2160p.WEB-DL
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                <span>WEB-DL</span>
                <span className="h-1 w-1 rounded-full bg-ink-subtle/40" />
                <span>18.4 GB</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-ink-muted">
                <Zap size={12} fill="currentColor" strokeWidth={0} />
                Cached on Real-Debrid
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 items-center gap-2 rounded-full bg-ink px-7 text-[14px] font-semibold tracking-[0.04em] text-canvas shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                <Play size={18} fill="currentColor" strokeWidth={0} />
                Play
              </span>
              <AddonLogo addonId="example-a" addonName="Source A" size="lg" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">Switch quality</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((tier, i) => (
            <div
              key={tier.label}
              className={`flex min-h-[48px] min-w-0 items-center gap-2 rounded-[12px] border px-2.5 py-2 ${
                i === 0 ? "border-ink/35 bg-ink/[0.05]" : "border-edge-soft"
              } ${tier.dim ? "opacity-65" : ""}`}
            >
              <FormatBadge kind={tier.badge} size="md" />
              <div className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink">{tier.label}</span>
                <span className="flex items-center gap-1 text-[10.5px] font-semibold tracking-[0.04em] text-ink-subtle">
                  {tier.instant ? (
                    <Zap size={9} fill="currentColor" strokeWidth={0} className="text-accent/80" />
                  ) : (
                    <Zap size={9} strokeWidth={2} className="text-ink-muted/70" />
                  )}
                  {tier.status} · {tier.size}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-elevated/40 px-4 py-3 ring-1 ring-edge-soft/50">
        <span className="text-[13px] font-medium text-ink-muted">All sources</span>
        <ChevronDown size={16} className="text-ink-subtle" />
      </div>
    </>
  );
}

const TIERS: Array<{ badge: BadgeKind; label: string; status: string; size: string; instant?: boolean; dim?: boolean }> = [
  { badge: "4k-uhd", label: "4K", status: "Instant", size: "18.4 GB", instant: true },
  { badge: "1080p", label: "1080p", status: "Cached", size: "2.6 GB" },
  { badge: "720p", label: "720p", status: "Cache", size: "1.1 GB", dim: true },
];

function GridIcon() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated ring-1 ring-edge-soft">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" className="text-ink-muted" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" className="text-ink-muted" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" className="text-ink-muted" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" className="text-ink-muted" />
      </svg>
    </span>
  );
}

const SOURCES: Array<{ addonId: string; addonName: string; headline: string; desc: string; file: string; badges: BadgeKind[] }> = [
  {
    addonId: "example-a",
    addonName: "Source A",
    headline: "Example Movie 2024 2160p WEB-DL",
    desc: "👤 24 💾 18.4 GB ⚙️ RD",
    file: "Example.Movie.2024.2160p.WEB-DL.Atmos.HDR.mkv",
    badges: ["4k-uhd", "webdl", "hevc", "hdr", "atmos"],
  },
  {
    addonId: "example-b",
    addonName: "Source B",
    headline: "Example Movie (2024) 1080p BluRay",
    desc: "👤 11 💾 2.6 GB",
    file: "Example.Movie.2024.1080p.BluRay.mp4",
    badges: ["1080p", "bluray"],
  },
  {
    addonId: "example-c",
    addonName: "Source C",
    headline: "Example Movie 2024 1080p WEB-DL DDP5.1",
    desc: "👤 8 💾 4.1 GB",
    file: "Example.Movie.2024.1080p.WEB-DL.DDP5.1.mkv",
    badges: ["1080p", "webdl", "ddp"],
  },
];

function SourceRow({ src, filename }: { src: (typeof SOURCES)[number]; filename?: boolean }) {
  return (
    <div className="flex items-stretch gap-3.5 rounded-2xl bg-elevated/40 p-3.5 ring-1 ring-edge-soft/50">
      <div className="flex w-[44px] shrink-0 items-center justify-center">
        <AddonLogo addonId={src.addonId} addonName={src.addonName} size="xl" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p className="truncate text-[14px] font-semibold leading-snug text-ink">{src.headline}</p>
        <p className="truncate text-[12.5px] leading-snug text-ink-muted">{src.desc}</p>
        {filename && (
          <p className="truncate font-mono text-[11px] leading-snug text-ink-subtle/80">{src.file}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {src.badges.map((k) => (
            <FormatBadge key={k} kind={k} size="sm" />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center self-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-canvas">
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </span>
      </div>
    </div>
  );
}

function StremioMock() {
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-elevated/60 px-4 py-2.5 text-[14px] font-medium text-ink ring-1 ring-edge-soft">
        <div className="flex items-center gap-3">
          <GridIcon />
          <span>All</span>
        </div>
        <ChevronDown size={18} strokeWidth={2.2} className="text-ink-muted" />
      </div>
      {SOURCES.map((s) => (
        <SourceRow key={s.addonId} src={s} />
      ))}
    </>
  );
}

export function TorrentNamePreview({ on }: { on: boolean }) {
  return (
    <Shell>
      {SOURCES.slice(0, 2).map((s) => (
        <SourceRow key={s.addonId} src={s} filename={on} />
      ))}
    </Shell>
  );
}

const DESC = [
  "Example.Movie.2024.2160p.WEB-DL.Atmos.HDR.mkv",
  "👤 142 💾 18.4 GB ⚙️ RealDebrid · Instant",
  "🌐 English · Spanish · French · German",
  "🎞️ HDR10 · Dolby Atmos 7.1 · HEVC",
  "📁 Example Movie (2024) [2160p WEB-DL]",
].join("\n");

export function StreamDescriptionPreview({ full }: { full: boolean }) {
  return (
    <Shell>
      <div className="flex items-stretch gap-3.5 rounded-2xl bg-elevated/40 p-3.5 ring-1 ring-edge-soft/50">
        <div className="flex w-[44px] shrink-0 items-center justify-center">
          <AddonLogo addonId="example-a" addonName="Source A" size="xl" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="truncate text-[14px] font-semibold leading-snug text-ink">
            Example Movie 2024 2160p WEB-DL
          </p>
          <p className={`whitespace-pre-line text-[12.5px] leading-snug text-ink-muted ${full ? "" : "line-clamp-3"}`}>
            {DESC}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["4k-uhd", "webdl", "hevc", "hdr", "atmos"] as BadgeKind[]).map((k) => (
              <FormatBadge key={k} kind={k} size="sm" />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-canvas">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </span>
        </div>
      </div>
    </Shell>
  );
}
