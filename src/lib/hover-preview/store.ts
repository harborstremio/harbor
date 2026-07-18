import type { Meta } from "../cinemeta";
import { createDismissListeners } from "./dismiss-listeners";
import { assemblePreviewData, type PreviewArt, type PreviewAssembly } from "./preview-data";
import {
  DATA_GRACE_MS,
  DWELL_MS,
  FETCH_INTENT_MS,
  LEAVE_GRACE_MS,
  MORPH_SETTLE_MS,
} from "./timing";

export { publishResumeStates } from "./resume-index";
export type { AnchorRect, HoverGates, HoverPreviewSnapshot, PreviewPayload } from "./store-types";

import type { AnchorRect, HoverGates, HoverPreviewSnapshot, Morph, Pending } from "./store-types";

let gates: HoverGates = {
  enabled: false,
  finePointer: false,
  viewClear: false,
  searchClosed: false,
  menuClosed: false,
};

const subs = new Set<() => void>();
let snapshot: HoverPreviewSnapshot = {
  status: "idle",
  closeMode: "hard",
  openSeq: 0,
  morphSeq: 0,
  artSeq: 0,
  payload: null,
};

let pending: Pending | null = null;
let open: { meta: Meta; el: HTMLElement; assembly: PreviewAssembly } | null = null;
let morph: Morph | null = null;
let panelEl: HTMLElement | null = null;
let insideAnchor = false;
let insidePanel = false;
let graceTimer = 0;

function emit(): void {
  for (const fn of subs) fn();
}

function gatesPass(): boolean {
  return (
    gates.enabled &&
    gates.finePointer &&
    gates.viewClear &&
    gates.searchClosed &&
    gates.menuClosed &&
    document.visibilityState === "visible"
  );
}

function rectOf(r: DOMRect): AnchorRect {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function clearPending(): void {
  if (!pending) return;
  window.clearTimeout(pending.intentTimer);
  window.clearTimeout(pending.dwellTimer);
  window.clearTimeout(pending.deadlineTimer);
  pending.assembly?.cancel();
  pending = null;
}

function clearMorph(): void {
  if (!morph) return;
  window.clearTimeout(morph.settleTimer);
  window.clearTimeout(morph.deadlineTimer);
  morph.assembly?.cancel();
  morph = null;
}

function clearGraceTimer(): void {
  if (!graceTimer) return;
  window.clearTimeout(graceTimer);
  graceTimer = 0;
}

function finishClose(mode: "soft" | "hard"): void {
  clearPending();
  clearMorph();
  clearGraceTimer();
  insideAnchor = false;
  insidePanel = false;
  if (open) {
    open.assembly.cancel();
    open = null;
    snapshot = { ...snapshot, status: "idle", closeMode: mode };
    emit();
  }
  syncListeners();
}

function cancelEverything(): void {
  clearPending();
  if (open) finishClose("hard");
  else syncListeners();
}

const setListening = createDismissListeners({
  insidePanel: (target) =>
    !!open && !!panelEl && target instanceof Node && panelEl.contains(target),
  cancel: cancelEverything,
  escape: () => {
    if (!open) return false;
    finishClose("hard");
    return true;
  },
  hidden: () => document.visibilityState !== "visible",
});

function syncListeners(): void {
  setListening(pending !== null || open !== null);
}

function onLateArt(art: PreviewArt): void {
  if (!open || !snapshot.payload) return;
  snapshot = {
    ...snapshot,
    artSeq: snapshot.artSeq + 1,
    payload: { ...snapshot.payload, data: { ...snapshot.payload.data, art } },
  };
  emit();
}

function doOpen(p: Pending): void {
  if (pending !== p || !p.assembly) return;
  window.clearTimeout(p.deadlineTimer);
  if (!gatesPass() || !p.el.isConnected) {
    clearPending();
    syncListeners();
    return;
  }
  const rect = p.el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    clearPending();
    syncListeners();
    return;
  }
  const assembly = p.assembly;
  window.clearTimeout(p.intentTimer);
  window.clearTimeout(p.dwellTimer);
  pending = null;
  open = { meta: p.meta, el: p.el, assembly };
  insideAnchor = true;
  insidePanel = false;
  clearGraceTimer();
  assembly.markOpened(onLateArt);
  snapshot = {
    ...snapshot,
    status: "open",
    openSeq: snapshot.openSeq + 1,
    morphSeq: 0,
    artSeq: 0,
    payload: { meta: p.meta, data: assembly.data(), rect: rectOf(rect) },
  };
  emit();
  syncListeners();
}

function tryCommit(p: Pending): void {
  if (pending !== p) return;
  if (!gatesPass()) {
    clearPending();
    syncListeners();
    return;
  }
  if (!p.assembly) p.assembly = assemblePreviewData(p.meta);
  const a = p.assembly;
  if (a.isFinal()) {
    doOpen(p);
    return;
  }
  p.deadlineTimer = window.setTimeout(() => doOpen(p), DATA_GRACE_MS);
  a.onFinal(() => {
    if (pending === p) doOpen(p);
  });
}

function startPending(meta: Meta, el: HTMLElement): void {
  clearPending();
  const p: Pending = { meta, el, assembly: null, intentTimer: 0, dwellTimer: 0, deadlineTimer: 0 };
  pending = p;
  p.intentTimer = window.setTimeout(() => {
    if (pending === p && !p.assembly) p.assembly = assemblePreviewData(meta);
  }, FETCH_INTENT_MS);
  p.dwellTimer = window.setTimeout(() => tryCommit(p), DWELL_MS);
  syncListeners();
}

function evaluateUnion(): void {
  if (!open) return;
  if (insideAnchor || insidePanel || morph) {
    clearGraceTimer();
    return;
  }
  if (!graceTimer) {
    graceTimer = window.setTimeout(() => {
      graceTimer = 0;
      finishClose("soft");
    }, LEAVE_GRACE_MS);
  }
}

function finalizeMorph(m: Morph): void {
  if (morph !== m || !open || !m.assembly) return;
  window.clearTimeout(m.deadlineTimer);
  if (!m.el.isConnected) {
    clearMorph();
    evaluateUnion();
    return;
  }
  const rect = m.el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    clearMorph();
    evaluateUnion();
    return;
  }
  const assembly = m.assembly;
  window.clearTimeout(m.settleTimer);
  morph = null;
  open.assembly.cancel();
  open = { meta: m.meta, el: m.el, assembly };
  insideAnchor = true;
  clearGraceTimer();
  assembly.markOpened(onLateArt);
  snapshot = {
    ...snapshot,
    morphSeq: snapshot.morphSeq + 1,
    artSeq: 0,
    payload: { meta: m.meta, data: assembly.data(), rect: rectOf(rect) },
  };
  emit();
}

function commitMorph(m: Morph): void {
  if (morph !== m || !open) return;
  if (!gatesPass() || !m.el.isConnected) {
    clearMorph();
    evaluateUnion();
    return;
  }
  m.assembly = assemblePreviewData(m.meta);
  if (m.assembly.isFinal()) {
    finalizeMorph(m);
    return;
  }
  m.deadlineTimer = window.setTimeout(() => finalizeMorph(m), DATA_GRACE_MS);
  m.assembly.onFinal(() => {
    if (morph === m) finalizeMorph(m);
  });
}

function armMorph(meta: Meta, el: HTMLElement): void {
  if (!open) return;
  if (morph?.el === el) return;
  clearMorph();
  const m: Morph = { meta, el, assembly: null, settleTimer: 0, deadlineTimer: 0 };
  morph = m;
  clearGraceTimer();
  m.settleTimer = window.setTimeout(() => commitMorph(m), MORPH_SETTLE_MS);
}

export function hoverPreviewEnter(meta: Meta, el: HTMLElement, buttons = 0): void {
  if (!gatesPass() || buttons !== 0) return;
  if (open) {
    if (el === open.el) {
      insideAnchor = true;
      evaluateUnion();
      return;
    }
    armMorph(meta, el);
    return;
  }
  if (pending?.el === el) return;
  startPending(meta, el);
}

export function hoverPreviewLeave(el: HTMLElement): void {
  if (pending?.el === el) {
    clearPending();
    syncListeners();
  }
  if (morph?.el === el) {
    clearMorph();
    evaluateUnion();
  }
  if (open?.el === el) {
    insideAnchor = false;
    evaluateUnion();
  }
}

export function hoverPreviewFocus(meta: Meta, cardEl: HTMLElement): void {
  if (!cardEl.matches(":focus-visible")) return;
  const anchor = cardEl.querySelector<HTMLElement>("[data-preview-anchor]") ?? cardEl;
  hoverPreviewEnter(meta, anchor, 0);
}

export function hoverPreviewBlur(cardEl: HTMLElement): void {
  const anchor = cardEl.querySelector<HTMLElement>("[data-preview-anchor]") ?? cardEl;
  hoverPreviewLeave(anchor);
}

export function hoverPreviewPanelEnter(): void {
  insidePanel = true;
  if (open) evaluateUnion();
}

export function hoverPreviewPanelLeave(): void {
  insidePanel = false;
  if (open) evaluateUnion();
}

export function setHoverPreviewPanel(el: HTMLElement | null): void {
  panelEl = el;
}

export function closeHoverPreview(mode: "soft" | "hard" = "hard"): void {
  finishClose(mode);
}

export function setHoverPreviewGates(g: HoverGates): void {
  gates = g;
  if (!gatesPass()) cancelEverything();
}

export function subscribeHoverPreview(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function getHoverPreviewSnapshot(): HoverPreviewSnapshot {
  return snapshot;
}
