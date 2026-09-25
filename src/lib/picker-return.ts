import type { Meta } from "./cinemeta";
import type { Frame, PlayEpisode, PickerOptions } from "./view";

/** Preserve the normal Details exit; a contextual download explicitly owns its return. */
export function pickerExitStack(stack: Frame[], meta: Meta): Frame[] {
  let index = stack.length - 1;
  const picker = stack
    .slice()
    .reverse()
    .find((frame) => frame.kind === "picker");
  while (index > 0 && (stack[index].kind === "player" || stack[index].kind === "picker")) index--;
  const base = stack.slice(0, index + 1);
  if (
    picker?.meta.id === meta.id &&
    picker.meta.type === meta.type &&
    picker.intent === "download" &&
    picker.returnTo === "previous" &&
    picker.contextRequestId
  )
    return base;
  if (base.at(-1)?.kind === "meta") return base;
  return [...base, { kind: "meta", meta }];
}

export function samePickerRequest(
  frame: Frame,
  meta: Meta,
  episode?: PlayEpisode,
  options?: PickerOptions,
): boolean {
  if (frame.kind !== "picker") return false;
  return (
    frame.meta.id === meta.id &&
    frame.meta.type === meta.type &&
    frame.episode?.season === episode?.season &&
    frame.episode?.episode === episode?.episode &&
    frame.episode?.videoId === episode?.videoId &&
    frame.episode?.sourceMetaId === episode?.sourceMetaId &&
    frame.episode?.kitsuStreamId === episode?.kitsuStreamId &&
    (frame.attempt ?? 0) === (options?.attempt ?? 0) &&
    (frame.intent ?? "play") === (options?.intent ?? "play") &&
    Boolean(frame.seasonEpisodes?.length) === Boolean(options?.seasonEpisodes?.length) &&
    frame.contextRequestId === options?.contextRequestId &&
    frame.continuation?.id === options?.continuation?.id
  );
}
