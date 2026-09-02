import opensubtitlesLogo from "@/assets/opensubtitles.png";

function CaptionGlyph() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="5" y="8.6" width="6" height="2.2" rx="1.1" opacity="0.95" />
      <rect x="12.6" y="8.6" width="6.4" height="2.2" rx="1.1" opacity="0.72" />
      <rect x="5" y="13.2" width="8.4" height="2.2" rx="1.1" opacity="0.72" />
      <rect x="15" y="13.2" width="4" height="2.2" rx="1.1" opacity="0.95" />
    </svg>
  );
}

export function OpenSubsMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-[5px] ring-1 ring-edge-soft/60">
      <img src={opensubtitlesLogo} alt="" draggable={false} className="h-full w-full object-contain" />
    </span>
  );
}

export function SubdlMark() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ring-1 ring-edge-soft/60"
      style={{ background: "#2563eb" }}
    >
      <CaptionGlyph />
    </span>
  );
}

export function SubsourceMark() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ring-1 ring-edge-soft/60"
      style={{ background: "#7c3aed" }}
    >
      <CaptionGlyph />
    </span>
  );
}
