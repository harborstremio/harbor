type LinkOutActivationEvent = {
  button?: number;
  target: EventTarget | null;
  preventDefault(): void;
};

type LinkTarget = {
  closest?(selector: string): { getAttribute(name: string): string | null } | null;
};

export function safeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function handleLinkOutActivation(
  event: LinkOutActivationEvent,
  open: (href: string) => void,
): boolean {
  if (event.button != null && event.button > 1) return false;
  const anchor = (event.target as LinkTarget | null)?.closest?.("a");
  const href = anchor?.getAttribute("href");
  if (!href) return false;
  event.preventDefault();
  const safeHref = safeExternalUrl(href);
  if (safeHref) open(safeHref);
  return true;
}
