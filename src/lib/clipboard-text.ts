import { invoke, isTauri } from "@tauri-apps/api/core";

export async function copyText(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      await invoke("plugin:clipboard-manager|write_text", { text });
      return true;
    } catch {
      return false;
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Older browser contexts may still allow the user-initiated legacy command.
  }
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  const input =
    active && /^(INPUT|TEXTAREA)$/.test(active.tagName)
      ? (active as HTMLInputElement | HTMLTextAreaElement)
      : null;
  const start = input?.selectionStart;
  const end = input?.selectionEnd;
  const direction = input?.selectionDirection;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const textarea = document.createElement("textarea");
  try {
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.setAttribute("aria-hidden", "true");
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (active?.isConnected) active.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
    if (input?.isConnected && start != null && end != null)
      input.setSelectionRange(start, end, direction ?? undefined);
  }
}
