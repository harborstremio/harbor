import type { ExternalLinkDestinationPreference } from "./external-link-preference.ts";
import { settleLinkOutOpen, type LinkOutJourney } from "./link-out.ts";

export type ExternalLinkDestinationSource = "main" | "alternate";
export type ExternalLinkMenuDismissReason = "back" | "outside" | "selection";

type ExternalLinkMenuActions = {
  setMenuOpen: (open: boolean) => void;
  restoreMenuButtonFocus?: () => void;
};

type ExternalLinkBackActions = ExternalLinkMenuActions & {
  closeJourney: () => void;
};

type ExternalLinkDestinationActions = {
  setMenuOpen: (open: boolean) => void;
  rememberPreference: (action: ExternalLinkDestinationPreference) => void;
  openInHarbor: () => void;
  openInBrowser: () => void;
};

export type ExternalLinkBrowserOpenError = {
  code: "browser-open-failed";
  detail: string | null;
};

export type ExternalLinkBrowserOpenOptions = {
  journey: LinkOutJourney;
  href: string;
  openingRef: { current: boolean };
  isCurrentJourney: (journey: LinkOutJourney) => boolean;
  openUrl: (href: string) => Promise<unknown>;
  closeJourney: () => void;
  setOpening: (opening: boolean) => void;
  setError: (error: ExternalLinkBrowserOpenError | null) => void;
};

export function hasExternalLinkAlternateDestination(
  alternate: ExternalLinkDestinationPreference | null,
): alternate is ExternalLinkDestinationPreference {
  return alternate !== null;
}

export function dismissExternalLinkMenu(
  reason: ExternalLinkMenuDismissReason,
  actions: ExternalLinkMenuActions,
): void {
  actions.setMenuOpen(false);
  if (reason === "back") actions.restoreMenuButtonFocus?.();
}

export function handleExternalLinkBack(menuOpen: boolean, actions: ExternalLinkBackActions): true {
  if (menuOpen) {
    dismissExternalLinkMenu("back", actions);
    return true;
  }
  actions.closeJourney();
  return true;
}

export function chooseExternalLinkDestination(
  action: ExternalLinkDestinationPreference,
  source: ExternalLinkDestinationSource,
  actions: ExternalLinkDestinationActions,
): void {
  dismissExternalLinkMenu("selection", actions);
  if (source === "alternate") actions.rememberPreference(action);
  if (action === "harbor") actions.openInHarbor();
  else actions.openInBrowser();
}

function browserOpenError(error: unknown): ExternalLinkBrowserOpenError {
  return {
    code: "browser-open-failed",
    detail: error instanceof Error ? error.message : null,
  };
}

export async function openExternalLinkInBrowser({
  journey,
  href,
  openingRef,
  isCurrentJourney,
  openUrl,
  closeJourney,
  setOpening,
  setError,
}: ExternalLinkBrowserOpenOptions): Promise<void> {
  if (openingRef.current) return;
  openingRef.current = true;
  setOpening(true);
  setError(null);

  let opening: Promise<unknown>;
  try {
    opening = openUrl(href);
  } catch (error) {
    opening = Promise.reject(error);
  }

  await settleLinkOutOpen(isCurrentJourney, journey, opening, {
    onSuccess: closeJourney,
    onError: (error) => setError(browserOpenError(error)),
    onSettled: () => {
      openingRef.current = false;
      setOpening(false);
    },
  });
}
