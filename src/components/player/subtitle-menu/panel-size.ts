export type SubtitlePanelSize = { width: number; height: number };

export const DEFAULT_SUBTITLE_PANEL_SIZE: SubtitlePanelSize = { width: 560, height: 460 };
const MIN_WIDTH = 420;
const MIN_HEIGHT = 320;
const MAX_WIDTH = 920;
const MAX_HEIGHT = 720;
const VIEWPORT_INLINE_MARGIN = 48;
const PLAYER_CONTROLS_SPACE = 120;

export function clampSubtitlePanelSize(
  size: SubtitlePanelSize,
  viewport: SubtitlePanelSize,
): SubtitlePanelSize {
  const availableWidth = Math.max(1, viewport.width - VIEWPORT_INLINE_MARGIN);
  const availableHeight = Math.max(1, viewport.height - PLAYER_CONTROLS_SPACE);
  const maxWidth = Math.min(MAX_WIDTH, availableWidth);
  const maxHeight = Math.min(MAX_HEIGHT, availableHeight);
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_HEIGHT, maxHeight);

  return {
    width: Math.round(Math.min(maxWidth, Math.max(minWidth, size.width))),
    height: Math.round(Math.min(maxHeight, Math.max(minHeight, size.height))),
  };
}
