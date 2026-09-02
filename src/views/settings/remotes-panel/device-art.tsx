export type DeviceKind = "web" | "remote" | "reader";

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect
        x="14"
        y="3"
        width="36"
        height="58"
        rx="7"
        className="fill-canvas"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1.6}
      />
      <rect x="27" y="6.5" width="10" height="2" rx="1" className="fill-ink" opacity={0.25} />
      {children}
    </>
  );
}

function WebArt() {
  return (
    <>
      <rect
        x="3"
        y="10"
        width="58"
        height="42"
        rx="5"
        className="fill-canvas"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1.6}
      />
      <path d="M3 18h58" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1.4} />
      <g className="fill-ink" opacity={0.28}>
        <circle cx="9" cy="14" r="1.6" />
        <circle cx="14.5" cy="14" r="1.6" />
        <circle cx="20" cy="14" r="1.6" />
      </g>
      <rect x="8" y="23" width="30" height="12" rx="2.5" className="fill-accent" opacity={0.55} />
      <g className="fill-ink" opacity={0.22}>
        <rect x="42" y="23" width="14" height="12" rx="2.5" />
        <rect x="8" y="39" width="13" height="8" rx="2" />
        <rect x="24" y="39" width="13" height="8" rx="2" />
        <rect x="40" y="39" width="13" height="8" rx="2" />
      </g>
      <rect x="24" y="52" width="16" height="7" rx="2" className="fill-ink" opacity={0.16} />
    </>
  );
}

function RemoteArt() {
  return (
    <Phone>
      <circle
        cx="32"
        cy="26"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.6}
      />
      <g className="fill-accent" opacity={0.75}>
        <path d="M32 18.5l2.4 3.4h-4.8z" />
        <path d="M32 33.5l-2.4-3.4h4.8z" />
        <path d="M24.5 26l3.4-2.4v4.8z" />
        <path d="M39.5 26l-3.4 2.4v-4.8z" />
      </g>
      <circle cx="32" cy="26" r="3.6" className="fill-ink" opacity={0.3} />
      <g className="fill-ink" opacity={0.26}>
        <rect x="19" y="43" width="8" height="6" rx="2" />
        <rect x="37" y="43" width="8" height="6" rx="2" />
      </g>
      <circle cx="32" cy="46" r="4.6" className="fill-accent" opacity={0.75} />
      <rect x="19" y="53" width="26" height="3" rx="1.5" className="fill-ink" opacity={0.18} />
    </Phone>
  );
}

function ReaderArt() {
  return (
    <Phone>
      <rect
        x="20"
        y="14"
        width="24"
        height="30"
        rx="2.5"
        className="fill-ink"
        opacity={0.14}
      />
      <path d="M32 14v30" stroke="currentColor" strokeOpacity={0.28} strokeWidth={1.4} />
      <g className="fill-ink" opacity={0.26}>
        <rect x="23" y="19" width="6" height="1.8" rx="0.9" />
        <rect x="23" y="23" width="6" height="1.8" rx="0.9" />
        <rect x="35" y="19" width="6" height="1.8" rx="0.9" />
        <rect x="35" y="23" width="6" height="1.8" rx="0.9" />
        <rect x="23" y="27" width="6" height="1.8" rx="0.9" />
      </g>
      <g className="fill-accent" opacity={0.75}>
        <path d="M23.5 52l-4 3.2 4 3.2z" />
        <path d="M40.5 52l4 3.2-4 3.2z" />
      </g>
      <rect x="28" y="52.6" width="8" height="6" rx="2" className="fill-ink" opacity={0.22} />
    </Phone>
  );
}

export function DeviceArt({ kind }: { kind: DeviceKind }) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full text-ink" role="img" aria-hidden>
      {kind === "web" ? <WebArt /> : kind === "remote" ? <RemoteArt /> : <ReaderArt />}
    </svg>
  );
}
