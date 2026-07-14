import type { UnlistenFn } from "@tauri-apps/api/event";

export type ModalPayload = {
  kind: string;
  state: unknown;
};

let overlayOpen = false;

if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
  void import("@tauri-apps/api/core").then(({ invoke: _ }) => {});
  void import("@tauri-apps/api/event").then(({ listen }) => {
    void listen("modal://closed", () => { overlayOpen = false; });
    void listen("modal://show", () => { overlayOpen = true; });
  });
}


export function isModalOverlayOpen(): boolean {
  return overlayOpen;
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function modalOverlayOpen(kind: string, state: unknown): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("modal_overlay_open", { payload: { kind, state } });
  overlayOpen = true;
}

export async function modalOverlayClose(): Promise<void> {
  overlayOpen = false;
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("modal_overlay_close").catch(() => {});
}

export async function modalOverlayEmitState(kind: string, state: unknown): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("modal_overlay_emit_state", { payload: { kind, state } }).catch(() => {});
}

export async function modalOverlayEmitAction(event: string, payload: unknown): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("modal_overlay_emit_action", { event, payload }).catch(() => {});
}

export async function modalOverlaySync(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("modal_overlay_sync").catch(() => {});
}

export async function modalOverlayGetPending(): Promise<ModalPayload | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<ModalPayload | null>("modal_overlay_get_pending")) ?? null;
  } catch {
    return null;
  }
}

export async function onModalState(handler: (p: ModalPayload) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<ModalPayload>("modal://state", (e) => handler(e.payload));
}

export async function onModalShow(handler: (p: ModalPayload) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<ModalPayload>("modal://show", (e) => handler(e.payload));
}

export async function onModalClosedFromOverlay(handler: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen("modal://closed", () => handler());
}
