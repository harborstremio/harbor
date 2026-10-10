import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLinkSplitButton } from "@/components/external-link-split-button";
import { ExternalLinkViewer } from "@/components/external-link-viewer";
import { pushBackHandler } from "@/lib/back-intercept";
import { createExternalLinkViewerFocusScope } from "@/lib/external-link-viewer-modal";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import {
  chooseExternalLinkDestination,
  handleExternalLinkBack,
  openExternalLinkInBrowser,
  type ExternalLinkBrowserOpenError,
} from "@/lib/social/external-link-journey-controller";
import {
  readExternalLinkDestinationPreference,
  resolveExternalLinkActionLayout,
  writeExternalLinkDestinationPreference,
  type ExternalLinkDestinationPreference,
} from "@/lib/social/external-link-preference";
import { parseExternalLink } from "@/lib/social/external-link-policy";
import {
  closeLinkOut,
  isCurrentLinkOutJourney,
  type LinkOutJourney,
  useLinkOutJourney,
} from "@/lib/social/link-out";
import { openExternalUrlStrict } from "@/lib/window";

type Stage = "warning" | "viewer";

export function LinkOutInterstitial() {
  const journey = useLinkOutJourney();
  const [preference, setPreference] = useState(readExternalLinkDestinationPreference);
  const rememberPreference = useCallback((next: ExternalLinkDestinationPreference) => {
    setPreference(next);
    writeExternalLinkDestinationPreference(next);
  }, []);

  if (!journey) return null;
  return createPortal(
    <LinkOutJourneyInterstitial
      key={journey.generation}
      journey={journey}
      preference={preference}
      onPreferenceChange={rememberPreference}
    />,
    document.body,
  );
}

function LinkOutJourneyInterstitial({
  journey,
  preference,
  onPreferenceChange,
}: {
  journey: LinkOutJourney;
  preference: ExternalLinkDestinationPreference;
  onPreferenceChange: (next: ExternalLinkDestinationPreference) => void;
}) {
  const t = useT();
  const parsed = useMemo(() => parseExternalLink(journey.url), [journey.url]);
  const [stage, setStage] = useState<Stage>("warning");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openingBrowser, setOpeningBrowser] = useState(false);
  const [browserError, setBrowserError] = useState<ExternalLinkBrowserOpenError | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const goBackRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpenRef = useRef(false);
  const closingRef = useRef(false);
  const openingBrowserRef = useRef(false);
  const actionLayout = parsed.ok
    ? resolveExternalLinkActionLayout(preference, parsed.link.canOpenInHarbor)
    : null;
  const browserErrorMessage =
    browserError?.detail ??
    (browserError?.code === "browser-open-failed"
      ? t("Harbor could not open your browser.")
      : null);

  const setMenuOpenState = useCallback((open: boolean) => {
    menuOpenRef.current = open;
    setMenuOpen(open);
  }, []);

  const closeJourney = useCallback(() => {
    if (closingRef.current) return;
    if (!isCurrentLinkOutJourney(journey)) return;
    closingRef.current = true;
    closeLinkOut();
  }, [journey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return createExternalLinkViewerFocusScope(dialog, goBackRef.current);
  }, []);

  const handleBack = useCallback(() => {
    return handleExternalLinkBack(menuOpenRef.current, {
      setMenuOpen: setMenuOpenState,
      restoreMenuButtonFocus: () =>
        window.requestAnimationFrame(() => menuButtonRef.current?.focus()),
      closeJourney,
    });
  }, [closeJourney, setMenuOpenState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      handleBack();
    };
    const onLocalBack = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleBack();
    };
    const removeBackHandler = pushBackHandler(handleBack);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("harbor:local-back", onLocalBack, true);
    return () => {
      removeBackHandler();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("harbor:local-back", onLocalBack, true);
    };
  }, [handleBack]);

  const openInHarbor = () => {
    if (!parsed.ok || !parsed.link.canOpenInHarbor) return;
    setBrowserError(null);
    setStage("viewer");
  };

  const openInBrowser = () => {
    if (!parsed.ok) return;
    void openExternalLinkInBrowser({
      journey,
      href: parsed.link.href,
      openingRef: openingBrowserRef,
      isCurrentJourney: isCurrentLinkOutJourney,
      openUrl: openExternalUrlStrict,
      closeJourney,
      setOpening: setOpeningBrowser,
      setError: setBrowserError,
    });
  };

  const chooseDestination = (
    action: ExternalLinkDestinationPreference,
    source: "main" | "alternate",
  ) => {
    chooseExternalLinkDestination(action, source, {
      setMenuOpen: setMenuOpenState,
      rememberPreference: onPreferenceChange,
      openInHarbor,
      openInBrowser,
    });
  };

  const host = parsed.ok ? parsed.link.hostname : journey.url;
  const destinationHref = parsed.ok ? parsed.link.href : journey.url.trim();
  const warningClass =
    "fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-canvas/95 px-6 py-10 backdrop-blur-xl animate-in fade-in duration-200";
  const viewerClass = "fixed inset-0 z-[300] flex flex-col bg-canvas";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={stage === "warning" ? "link-out-title" : undefined}
      aria-describedby={stage === "warning" ? "link-out-description" : undefined}
      aria-label={
        stage === "viewer" && parsed.ok
          ? t("External site: {hostname}", { hostname: parsed.link.hostname })
          : undefined
      }
      tabIndex={-1}
      data-tv-focus-scope
      className={stage === "warning" ? warningClass : viewerClass}
    >
      {stage === "viewer" && parsed.ok ? (
        <ExternalLinkViewer
          link={parsed.link}
          openingBrowser={openingBrowser}
          browserError={browserErrorMessage}
          onOpenBrowser={openInBrowser}
          onReload={() => setBrowserError(null)}
          onClose={closeJourney}
        />
      ) : (
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-elevated ring-1 ring-edge-soft">
            <ExternalLink size={26} className="text-ink-muted" strokeWidth={1.9} />
          </div>
          <h1
            id="link-out-title"
            className="mt-6 font-display text-[26px] font-medium tracking-tight text-ink"
          >
            {t("You're leaving Harbor")}
          </h1>
          <p id="link-out-description" className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            {t(
              "This link goes to an external site that Harbor does not control or vouch for. Triple-check the address before you continue, and never enter your Harbor password anywhere but Harbor.",
            )}
          </p>
          <div className="mt-6 flex flex-col gap-1 rounded-lg border border-edge-soft bg-surface p-4 text-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("Destination")}
            </span>
            <span className="truncate text-[17px] font-semibold text-ink">{host}</span>
            <span className="mt-1 break-all font-mono text-[12px] leading-snug text-ink-subtle">
              {destinationHref}
            </span>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-danger/12 px-3 py-1.5 text-[12px] font-medium text-danger">
            <TriangleAlert size={14} strokeWidth={2.2} />{" "}
            {t("Only continue if you fully trust this link")}
          </div>
          {!parsed.ok && (
            <p role="alert" className="mt-4 text-[13px] leading-relaxed text-danger">
              {parsed.reason === "unsupported-protocol"
                ? t("Harbor can open only HTTP or HTTPS destinations.")
                : parsed.reason === "embedded-credentials"
                  ? t("Harbor cannot open links that include embedded credentials.")
                  : t("Harbor could not verify this destination.")}
            </p>
          )}
          {parsed.ok && !parsed.link.canOpenInHarbor && (
            <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
              {t("Harbor's temporary viewer requires HTTPS.")}
            </p>
          )}
          {browserErrorMessage && (
            <p role="alert" className="mt-4 text-[13px] leading-relaxed text-danger">
              {browserErrorMessage}
            </p>
          )}
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button
              ref={goBackRef}
              type="button"
              onClick={closeJourney}
              data-tv-initial-focus
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-surface px-5 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-raised sm:w-auto"
            >
              <ArrowLeft size={18} /> {t("Go back")}
            </button>
            {actionLayout && (
              <ExternalLinkSplitButton
                main={actionLayout.main}
                alternate={actionLayout.alternate}
                menuOpen={menuOpen}
                disabled={openingBrowser}
                menuButtonRef={menuButtonRef}
                onMenuOpenChange={setMenuOpenState}
                onSelect={chooseDestination}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
