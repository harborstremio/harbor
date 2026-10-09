import type { ReactNode } from "react";

export function PreviewShell({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex w-fit max-w-full flex-col gap-2.5 rounded-md bg-canvas/40 p-3.5 ring-1 ring-edge-soft">
      {children}
      {note && (
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">{note}</span>
      )}
    </div>
  );
}

export function PreviewScreen({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative aspect-video w-[260px] max-w-full overflow-hidden rounded-md bg-canvas ring-1 ring-inset ring-edge-soft"
    >
      {children}
    </div>
  );
}
