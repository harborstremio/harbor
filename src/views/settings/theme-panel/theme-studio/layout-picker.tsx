import { Check } from "lucide-react";
import type { ThemeLayout } from "@/lib/theme";

type LayoutDef = {
  id: ThemeLayout;
  name: string;
  blurb: string;
  diagram: (active: boolean) => React.ReactNode;
};

const LAYOUTS: LayoutDef[] = [
  {
    id: "sidebar",
    name: "Sidebar",
    blurb: "Wide left bar with labels.",
    diagram: (a) => <Diagram active={a} kind="sidebar" />,
  },
  {
    id: "topdock",
    name: "Top dock",
    blurb: "Floating top pill with nav.",
    diagram: (a) => <Diagram active={a} kind="topdock" />,
  },
  {
    id: "rail",
    name: "Side rail",
    blurb: "Narrow icon-only column.",
    diagram: (a) => <Diagram active={a} kind="rail" />,
  },
  {
    id: "stremio",
    name: "Stremio rail",
    blurb: "Stremio-style narrow rail.",
    diagram: (a) => <Diagram active={a} kind="stremio" />,
  },
  {
    id: "minui",
    name: "Floating dock",
    blurb: "macOS-style bottom dock.",
    diagram: (a) => <Diagram active={a} kind="minui" />,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    blurb: "Immersive floating overlay nav.",
    diagram: (a) => <Diagram active={a} kind="cinematic" />,
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Write your own chrome with HTML + CSS.",
    diagram: (a) => <Diagram active={a} kind="custom" />,
  },
];

export function LayoutPicker({
  value,
  onChange,
}: {
  value: ThemeLayout;
  onChange: (v: ThemeLayout) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {LAYOUTS.map((l) => {
        const active = value === l.id;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(l.id)}
            className={`group relative flex flex-col gap-2 overflow-hidden rounded-lg border p-3 text-start transition-colors ${
              active
                ? "border-accent/80 bg-accent-soft"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-white/[0.04]"
            }`}
          >
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-edge-soft bg-surface">
              {l.diagram(active)}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13.5px] font-semibold text-ink">{l.name}</span>
                <span className="text-[11.5px] text-ink-subtle">{l.blurb}</span>
              </div>
              {active && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-canvas">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Diagram({ active, kind }: { active: boolean; kind: ThemeLayout }) {
  const accent = active ? "var(--color-accent)" : "var(--color-ink-subtle)";
  const dim = "var(--color-edge)";
  if (kind === "sidebar") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="3" y="3" width="22" height="54" rx="3" fill={accent} opacity="0.18" />
        <circle cx="14" cy="14" r="2" fill={accent} />
        <rect x="20" y="13" width="0" height="0" />
        <line x1="20" y1="14" x2="22" y2="14" stroke={accent} strokeWidth="2" />
        <circle cx="14" cy="22" r="2" fill={dim} />
        <circle cx="14" cy="30" r="2" fill={dim} />
        <rect x="29" y="6" width="48" height="6" rx="2" fill={dim} opacity="0.5" />
        <rect x="29" y="18" width="48" height="36" rx="2" fill={dim} opacity="0.3" />
      </svg>
    );
  }
  if (kind === "topdock") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="6" y="4" width="68" height="9" rx="4.5" fill={accent} opacity="0.18" />
        <circle cx="14" cy="8.5" r="1.8" fill={accent} />
        <circle cx="22" cy="8.5" r="1.8" fill={dim} />
        <circle cx="30" cy="8.5" r="1.8" fill={dim} />
        <circle cx="38" cy="8.5" r="1.8" fill={dim} />
        <rect x="6" y="18" width="68" height="38" rx="2" fill={dim} opacity="0.3" />
      </svg>
    );
  }
  if (kind === "rail") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="3" y="3" width="11" height="54" rx="3" fill={accent} opacity="0.18" />
        <circle cx="8.5" cy="12" r="2" fill={accent} />
        <circle cx="8.5" cy="22" r="2" fill={dim} />
        <circle cx="8.5" cy="32" r="2" fill={dim} />
        <circle cx="8.5" cy="42" r="2" fill={dim} />
        <rect x="18" y="6" width="59" height="6" rx="2" fill={dim} opacity="0.5" />
        <rect x="18" y="18" width="59" height="36" rx="2" fill={dim} opacity="0.3" />
      </svg>
    );
  }
  if (kind === "stremio") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="3" y="3" width="13" height="54" rx="3" fill={accent} opacity="0.18" />
        <rect x="6" y="9" width="7" height="7" rx="1.5" fill={accent} />
        <rect x="6" y="19" width="7" height="7" rx="1.5" fill={dim} />
        <rect x="6" y="29" width="7" height="7" rx="1.5" fill={dim} />
        <rect x="6" y="39" width="7" height="7" rx="1.5" fill={dim} />
        <rect x="20" y="6" width="57" height="48" rx="2" fill={dim} opacity="0.3" />
      </svg>
    );
  }
  if (kind === "minui") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="3" y="3" width="74" height="44" rx="2" fill={dim} opacity="0.3" />
        <rect x="20" y="49" width="40" height="8" rx="4" fill={accent} opacity="0.22" />
        <circle cx="26" cy="53" r="1.8" fill={dim} />
        <circle cx="33" cy="53" r="2.2" fill={accent} />
        <circle cx="41" cy="53" r="1.8" fill={dim} />
        <circle cx="48" cy="53" r="1.8" fill={dim} />
        <circle cx="55" cy="53" r="1.8" fill={dim} />
      </svg>
    );
  }
  if (kind === "cinematic") {
    return (
      <svg viewBox="0 0 80 60" className="h-full w-full">
        <rect x="3" y="3" width="74" height="54" rx="2" fill={accent} opacity="0.16" />
        <rect x="3" y="3" width="74" height="22" rx="2" fill={accent} opacity="0.10" />
        <rect x="22" y="7" width="36" height="7" rx="3.5" fill={accent} opacity="0.5" />
        <circle cx="29" cy="10.5" r="1.4" fill={accent} />
        <circle cx="36" cy="10.5" r="1.4" fill={dim} />
        <circle cx="43" cy="10.5" r="1.4" fill={dim} />
        <circle cx="50" cy="10.5" r="1.4" fill={dim} />
        <rect x="10" y="40" width="30" height="4" rx="2" fill={dim} opacity="0.6" />
        <rect x="10" y="47" width="20" height="3" rx="1.5" fill={dim} opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 60" className="h-full w-full">
      <rect
        x="3"
        y="3"
        width="74"
        height="54"
        rx="2"
        fill={accent}
        opacity="0.08"
        stroke={accent}
        strokeWidth="0.6"
        strokeDasharray="2 2"
      />
      <text
        x="40"
        y="28"
        textAnchor="middle"
        fill={accent}
        fontSize="9"
        fontWeight="600"
        fontFamily="monospace"
      >
        {"<your chrome/>"}
      </text>
      <text x="40" y="40" textAnchor="middle" fill={dim} fontSize="6.5" fontFamily="monospace">
        HTML · CSS · JS
      </text>
    </svg>
  );
}
