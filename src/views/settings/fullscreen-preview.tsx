import { useT } from "@/lib/i18n";

type Chrome = { titlebar: boolean; taskbar: boolean; inset: boolean; note: string };

export function FullscreenPreview({ mode }: { mode: string }) {
  const t = useT();
  const modes: Record<string, Chrome> = {
    fullscreen: {
      titlebar: false,
      taskbar: false,
      inset: false,
      note: t("Covers everything. The taskbar is hidden."),
    },
    borderless: {
      titlebar: false,
      taskbar: false,
      inset: false,
      note: t("Same coverage, but still a window, so alt-tab stays instant."),
    },
    maximized: {
      titlebar: true,
      taskbar: true,
      inset: true,
      note: t("Fills the screen, but the title bar and taskbar stay."),
    },
  };
  const chrome = modes[mode] ?? modes.fullscreen;

  return (
    <div className="flex w-[168px] shrink-0 flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-[7px] bg-canvas ring-1 ring-inset ring-edge-soft">
        <div
          aria-hidden
          className="absolute inset-0 flex flex-col transition-[padding] duration-300 ease-in-out"
          style={{ padding: chrome.inset ? "8%" : "0" }}
        >
          {chrome.titlebar && (
            <span className="flex h-[9px] shrink-0 items-center gap-[3px] rounded-t-[3px] bg-elevated pe-1 ps-1">
              <span className="h-[3px] w-[3px] rounded-full bg-ink-subtle" />
              <span className="h-[3px] w-[3px] rounded-full bg-ink-subtle" />
              <span className="h-[3px] w-[3px] rounded-full bg-ink-subtle" />
            </span>
          )}
          <span
            className={`flex min-h-0 flex-1 items-center justify-center bg-raised transition-[border-radius] duration-300 ease-in-out ${
              chrome.titlebar ? "rounded-b-[3px]" : ""
            }`}
          >
            <span className="h-0 w-0 border-y-[5px] border-s-[8px] border-y-transparent border-s-ink-subtle" />
          </span>
        </div>
        {chrome.taskbar && (
          <span className="absolute inset-x-0 bottom-0 flex h-[10%] items-center gap-[3px] bg-elevated ps-1.5">
            <span className="h-[4px] w-[4px] rounded-[1px] bg-ink-subtle" />
            <span className="h-[4px] w-[10px] rounded-[1px] bg-ink-subtle/60" />
            <span className="h-[4px] w-[10px] rounded-[1px] bg-ink-subtle/60" />
          </span>
        )}
      </div>
      <span className="text-[13px] leading-[17px] text-ink-subtle">{chrome.note}</span>
    </div>
  );
}
