/** Programmatic menu setup is not exploration; keyboard/remote movement is. */
export const MENU_FOCUS_INTENT = "harbor:menu-focus-intent";

export function focusMenuCommand(element: HTMLElement) {
  element.focus({ preventScroll: true });
  element.dispatchEvent(new window.Event(MENU_FOCUS_INTENT, { bubbles: true }));
}
