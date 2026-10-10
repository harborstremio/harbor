import { ChevronRight, ScanFace } from "lucide-react";
import { useT } from "@/lib/i18n";
import { XrayTile, type XrayPerson } from "./xray-actor-card";

export function XrayScene({
  people,
  poster,
  showName,
  onOpenAbout,
  onOpenPerson,
}: {
  people: XrayPerson[];
  onOpenPerson: (person: XrayPerson) => void;
  poster?: string;
  showName: string;
  onOpenAbout?: () => void;
}) {
  const t = useT();
  return (
    <div className="flex gap-5 overflow-x-auto px-1 pb-4 pt-1 [scrollbar-width:thin]">
      {poster && onOpenAbout && (
        <AboutCard poster={poster} showName={showName} onClick={onOpenAbout} />
      )}
      {people.map((p) => (
        <div key={`${p.id}:${p.sub ?? ""}`} className="w-44 shrink-0 sm:w-48">
          <XrayTile person={p} onOpenPerson={onOpenPerson} />
        </div>
      ))}
      {people.length === 0 && <SceneEmpty label={t("Looking for who is on screen")} />}
    </div>
  );
}

function AboutCard({
  poster,
  showName,
  onClick,
}: {
  poster: string;
  showName: string;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-44 shrink-0 overflow-hidden rounded-[16px] ring-1 ring-white/12 transition-shadow duration-200 hover:shadow-[0_20px_44px_-20px_rgba(0,0,0,0.9)] hover:ring-white/25 sm:w-48"
    >
      <img
        src={poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[450ms] ease-out group-hover:scale-[1.06] motion-reduce:group-hover:scale-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15" />
      <div className="absolute inset-0 flex flex-col items-start justify-end p-4 text-start">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
          {t("About")}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-tight text-white">
          {showName}
        </span>
        <span className="mt-2 flex items-center gap-0.5 text-[12px] font-semibold text-accent">
          {t("Details")}
          <ChevronRight size={13} strokeWidth={2.6} />
        </span>
      </div>
    </button>
  );
}

function SceneEmpty({ label }: { label: string }) {
  return (
    <div className="flex aspect-square w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/12 px-4 text-center text-white/45 sm:w-48">
      <ScanFace size={22} strokeWidth={1.8} />
      <span className="text-[12.5px] leading-snug">{label}</span>
    </div>
  );
}
