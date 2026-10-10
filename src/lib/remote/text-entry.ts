import { dispatchTvNav } from "@/lib/keyboard-navigation";
import type { RemoteTextEntry } from "./protocol";

/** Non-textual input types — everything else can be armed for remote typing. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "file",
  "image",
  "hidden",
  "range",
  "color",
]);

/** Explicit opt-in: focus alone publishes textEntry (e.g. global search). */
const TEXT_AUTO_ATTR = "data-tv-text-auto";

/** Armed by select/tap — focus alone does not publish textEntry. */
const TEXT_ACTIVE_ATTR = "data-remote-text-active";

let textEntryEl: HTMLInputElement | HTMLTextAreaElement | null = null;

function isTextEntryEl(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    return !NON_TEXT_INPUT_TYPES.has((el.type || "text").toLowerCase());
  }
  return false;
}

function isAutoTextField(el: HTMLElement): boolean {
  return el.hasAttribute(TEXT_AUTO_ATTR);
}

function isArmed(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  return isAutoTextField(el) || el.hasAttribute(TEXT_ACTIVE_ATTR);
}

/** Snapshot field for the phone keyboard — only when auto or select-armed. */
export function readHostTextEntry(): RemoteTextEntry | null {
  if (typeof document === "undefined") return null;
  const el = document.activeElement;
  if (!isTextEntryEl(el) || !isArmed(el)) return null;
  textEntryEl = el;
  return {
    value: el.value,
    placeholder: el.placeholder || "",
  };
}

/** Select on a focused field that isn't auto. True = consumed (skip click). */
export function armFocusedTextEntry(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!isTextEntryEl(el) || isAutoTextField(el) || el.hasAttribute(TEXT_ACTIVE_ATTR)) {
    return false;
  }
  el.setAttribute(TEXT_ACTIVE_ATTR, "");
  return true;
}

/** Phone Done — clear arming without moving HTPC focus (blurText command). */
export function disarmFocusedTextEntry(): void {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (isTextEntryEl(active)) active.removeAttribute(TEXT_ACTIVE_ATTR);
  textEntryEl?.removeAttribute(TEXT_ACTIVE_ATTR);
}

function resolveTextEntryEl(): HTMLInputElement | HTMLTextAreaElement | null {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (isTextEntryEl(active)) {
    textEntryEl = active;
    return active;
  }
  if (textEntryEl && document.contains(textEntryEl) && isTextEntryEl(textEntryEl)) {
    return textEntryEl;
  }
  return null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function applyTextToFocused(value: string) {
  const el = resolveTextEntryEl();
  if (!el) return;
  el.focus({ preventScroll: true });
  setNativeValue(el, value);
}

export function submitFocusedText() {
  const el = resolveTextEntryEl();
  if (!el) return;
  el.removeAttribute(TEXT_ACTIVE_ATTR);
  el.blur();
  dispatchTvNav("down");
}

function clearTextActiveOnFocusOut(e: FocusEvent) {
  const t = e.target;
  if (t instanceof Element && isTextEntryEl(t)) t.removeAttribute(TEXT_ACTIVE_ATTR);
}

export function installTextEntryListeners(): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("focusout", clearTextActiveOnFocusOut, true);
  return () => document.removeEventListener("focusout", clearTextActiveOnFocusOut, true);
}
