import { ChevronRight, Loader2, ScanFace, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { XrayRailCard, type XrayPerson } from "./xray-actor-card";

type Props = {
  people: XrayPerson[];
  castPeople?: XrayPerson[];
  ready: boolean;
  galleryReady: boolean;
  progress: { done: number; total: number };
  error: string | null;
  needsTmdbKey?: boolean;
  onViewAll: () => void;
  onClose: () => void;
};

export function XrayRail({
  people,
  castPeople,
  ready,
  galleryReady,
  progress,
  error,
  needsTmdbKey,
  onViewAll,
  onClose,
}: Props) {
  const t = useT();

  const emptyGallery = galleryReady && progress.total === 0;
  const canMatch = !error && !emptyGallery;
  const fallback = people.length === 0 && !canMatch && (castPeople?.length ?? 0) > 0;
  const list = people.length > 0 ? people : fallback ? (castPeople ?? []) : [];
  const status = error
    ? `${t("X-Ray unavailable")} — ${error}`
    : !ready
      ? t("Warming up")
      : !galleryReady
        ? progress.total > 0
          ? `${t("Reading the cast")} ${progress.done}/${progress.total}`
          : t("Reading the cast")
        : emptyGallery
          ? needsTmdbKey
            ? t("Add a TMDB key in Settings to identify the cast.")
            : t("No cast photos are available for this title.")
          : people.length === 0
            ? t("Looking for who is on screen")
            : null;

  return (
    <div className="pointer-events-auto absolute left-0 top-24 z-40 max-h-[68%] w-[300px] animate-xray-rail-in motion-reduce:animate-none">
      <div className="relative flex max-h-[68vh] flex-col overflow-hidden pe-3">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
        <div className="relative flex min-h-0 flex-col px-4 pb-5 pt-3">
          <header className="mb-2.5 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
              <ScanFace size={13} strokeWidth={2.4} className="text-accent" /> {t("X-Ray")}
            </span>
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center gap-0.5 rounded-full ps-2 pe-1 py-0.5 text-[11.5px] font-semibold text-white/65 transition-colors hover:text-white"
            >
              {t("View all")}
              <ChevronRight size={13} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Close")}
              className="ms-auto grid h-6 w-6 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          </header>

          {status && (
            <div className="flex items-center gap-2 py-1.5 text-[12.5px] text-white/70">
              {!error && !ready ? (
                <Loader2 size={13} className="shrink-0 animate-spin motion-reduce:animate-none" />
              ) : !error ? (
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
              ) : null}
              <span className="min-w-0 flex-1">{status}</span>
            </div>
          )}
          {list.length > 0 && (
            <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto pe-0.5 [scrollbar-width:thin]">
              {list.map((p) => (
                <XrayRailCard key={`${p.id}:${p.sub ?? ""}`} person={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
