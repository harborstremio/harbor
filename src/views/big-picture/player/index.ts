/**
 * The Big Picture player contract.
 *
 * Mount one BpPlayerShell while playback is open and declare panels inside it:
 *
 *   <BpPlayerShell src={player}>
 *     <BpPlayerSlot area="stage"><BpUpNext ... /></BpPlayerSlot>
 *     <BpPlayerSlot area="panel" id="subtitles" label="Subtitles" icon={<Captions />}>
 *       <BpPlayerSubtitles onClose={close} ... />
 *     </BpPlayerSlot>
 *   </BpPlayerShell>
 *
 * Inside a panel, useBpPlayer() gives the playback state, the chrome controls
 * and openPanel / closePanel.
 *
 * Keys, and this is the part that breaks if you get it wrong. While a panel is
 * open the shell drops its own key listener and the panel owns the D-pad, which
 * is what a panel that portals itself out of the shell wants. A panel that
 * renders in place and would rather be driven by the shell's spatial navigation
 * declares shellNav and then adds no listener of its own. Either way there is
 * never more than one listener acting on arrows: two both act, because
 * stopPropagation does not stop a second listener on the same object. A surface
 * that needs to steer one direction without owning everything registers through
 * setBpPlayerKeyHandler and returns false for the moves it does not want.
 */
export { BpPlayerShell } from "./bp-player-shell";
export {
  BpPlayerSlot,
  collectBpPlayerSlots,
  type BpPlayerArea,
  type BpPlayerSlotEntry,
  type BpPlayerSlotProps,
} from "./bp-player-slots";
export {
  useBpPlayer,
  useBpPlayerOptional,
  type BpChromePhase,
  type BpPlayerShellApi,
} from "./bp-player-context";
export {
  bpPlayerHandledKey,
  setBpPlayerKeyHandler,
  type BpPlayerKeyHandler,
} from "./bp-player-key";
export { useBpPlayback, type BpPlayback } from "./use-bp-playback";
export { BpPlayerScrub } from "./bp-player-scrub";
export { BpPlayerIdentity } from "./bp-player-identity";
export { BpPlayerControls } from "./bp-player-controls";
export { BpConnecting } from "./bp-connecting";
export { BpPlayerAudio, BpPlayerSources } from "./bp-player-sources";
export { BpPlayerSubtitles, type BpPlayerSubtitlesProps } from "./bp-player-subtitles";
export { BpResumePrompt } from "./bp-resume-prompt";
export { BpSkipPill } from "./bp-skip-pill";
export { BpUpNext } from "./bp-up-next";
export { BpP2pReadout, useBpP2pStatus, type BpP2pStatus } from "./bp-p2p-status";
