import { WindowCaptionPreview } from "@/chrome/hybrid-title-bar";
import { HybridMenuBar } from "@/chrome/hybrid-menu-bar";
import { WindowControlButton, WindowControlGlyph } from "@/chrome/window-control-button";
import { HarborMark } from "@/components/icons/harbor-mark";
import { UiIcon } from "@/components/ui-icon";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";

type Style = "transparent" | "glass" | "filled";

export function WindowControlArt({ style }: { style: Style }) {
  const t = useT();
  return (
    <div
      aria-hidden
      inert
      data-window-preview="controls"
      data-cleannav={style === "transparent" ? "on" : undefined}
      className="pointer-events-none flex w-fit max-w-full items-center gap-2 py-2"
    >
      <span className="contents [&>button]:w-11 [&>div]:w-11">
        <WindowControlButton label={t("chrome.watchTogether")} appearance={style}>
          <UiIcon name="watch-together" className="h-[17px] w-[17px]" />
        </WindowControlButton>
      </span>
      <WindowControlButton label={t("chrome.minimize")} appearance={style}>
        <WindowControlGlyph kind="minimize" />
      </WindowControlButton>
      <WindowControlButton label={t("chrome.maximize")} appearance={style}>
        <WindowControlGlyph kind="maximize" />
      </WindowControlButton>
      <WindowControlButton label={t("common.close")} appearance={style} danger>
        <WindowControlGlyph kind="close" />
      </WindowControlButton>
    </div>
  );
}

export function TitleBarArt() {
  const mac = osClass() === "macos";
  return (
    <div
      aria-hidden
      inert
      data-window-preview="native"
      className="pointer-events-none flex h-8 w-full items-center overflow-hidden rounded-t-lg border border-edge-soft bg-elevated"
    >
      {mac && <WindowCaptionPreview native />}
      <span className={`flex min-w-0 flex-1 items-center gap-2 px-2 text-[12px] text-ink ${mac ? "justify-center pe-16" : ""}`}>
        {!mac && <HarborMark className="h-4 w-4 shrink-0" />}
        Harbor
      </span>
      {!mac && <WindowCaptionPreview native />}
    </div>
  );
}

export function HybridBarArt() {
  const mac = osClass() === "macos";
  return (
    <div
      aria-hidden
      inert
      data-window-preview="hybrid"
      className="pointer-events-none flex h-9 w-full items-center overflow-hidden rounded-t-lg border border-edge-soft/70 bg-canvas/80 backdrop-blur-md"
    >
      {mac && <WindowCaptionPreview />}
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <div className="h-full w-max"><HybridMenuBar /></div>
      </div>
      {!mac && <WindowCaptionPreview />}
    </div>
  );
}
