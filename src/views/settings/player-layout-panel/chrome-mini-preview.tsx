import { useMemo } from "react";
import { renderControl, type ControlContext } from "@/components/player/transport/control-renderer";
import {
  RenderedStremioControl,
  type StremioRenderCtx,
} from "@/components/player/transport/control-renderer-stremio";
import type { PlayerChromeConfig, PlayerControlId, ThemeId } from "@/lib/player-chrome";
import { DefaultLayout, StremioLayout } from "./editor-chrome";
import { buildDefaultCtx, buildStremioCtx } from "./editor-mock-ctx";
import { usePreviewBackdrop } from "./use-preview-backdrop";

const NOOP = () => {};

export function ChromeMiniPreview({ theme, config }: { theme: ThemeId; config: PlayerChromeConfig }) {
  const bg = usePreviewBackdrop();

  const controlVariants = useMemo(
    () => Object.fromEntries(config.controls.map((c) => [c.id, c.variant ?? "auto"])),
    [config.controls],
  );

  const ctx = useMemo(() => {
    const opts = {
      mid: false,
      compact: true,
      tight: true,
      mode: "normal" as const,
      customIcons: config.customIcons,
      controlVariants,
      timeFormat: config.options.timeFormat,
      volumeStyle: config.options.volumeStyle,
    };
    return theme === "stremio" ? buildStremioCtx(opts) : buildDefaultCtx(opts);
  }, [theme, config.customIcons, controlVariants, config.options.timeFormat, config.options.volumeStyle]);

  const renderOne = (id: PlayerControlId) =>
    theme === "stremio" ? (
      <RenderedStremioControl id={id} ctx={ctx as StremioRenderCtx} />
    ) : (
      renderControl(id, ctx as ControlContext)
    );

  return (
    <div inert aria-hidden="true" data-tv-skip="" className="pointer-events-none absolute inset-0 overflow-hidden">
      {bg && (
        <img
          src={bg}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.42, filter: "saturate(1.1)" }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.10 0 0 / 0.35) 0%, oklch(0.06 0 0 / 0.72) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-3.5 pt-14">
        {theme === "stremio" ? (
          <StremioLayout config={config} selectedId={null} onSelect={NOOP} renderOne={renderOne} isLive={false} hideSeek />
        ) : (
          <DefaultLayout
            config={config}
            selectedId={null}
            onSelect={NOOP}
            renderOne={renderOne}
            isLive={false}
            compact
            hideSeek
          />
        )}
      </div>
    </div>
  );
}
