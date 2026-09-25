import { useCallback, useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { ArrowLeft, Lock, RefreshCw, Share2, UserRound } from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { copyText } from "@/components/player/copy-link-button";
import { emitListToast } from "@/components/lists/list-toast";
import type { ContextAction } from "@/lib/context-actions";
import { useContextMenu, type ContextMenuTarget } from "@/lib/context-menu";
import { clickedContent, contextPointerPoint } from "@/lib/context-content";
import { reloadAppWindow } from "@/lib/app-reload";
import { shareDeepLink } from "@/lib/deep-link";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useActiveKid, useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { openMyProfile } from "@/lib/social/open-my-profile";
import { canOpenProfile } from "@/lib/social/open-profile";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { captureSocialActor, assertSocialActor } from "@/lib/social/action-actor";
import { activeLayout, getThemeById, type ChromeNavId } from "@/lib/theme";
import { usePreviewNavCustomization, useThemePreview } from "@/lib/theme-preview";
import { useView, type PlayerSrc, type View } from "@/lib/view";
import { capturePlaybackActor, isPlaybackActorCurrent } from "@/lib/playback-history";
import {
  hasLocalBackCapability,
  requestAppBack,
  subscribeLocalBackCapability,
} from "@/lib/app-back";
import { ContextNavigationIcon } from "./context-navigation-icon";
import { useAvailableNavItems } from "./nav-items";
import { resolveContextNavigation, resolveSidebarNavigation } from "./navigation-policy";

const navigationListeners = new Set<() => void>();
function notifyPageNavigation() {
  navigationListeners.forEach((listener) => listener());
}
function subscribePageNavigation(listener: () => void) {
  navigationListeners.add(listener);
  return () => {
    navigationListeners.delete(listener);
  };
}

export function useSidebarNavigation() {
  const { settings } = useSettings();
  const { locked, hiddenTabs } = useParental();
  const kid = useActiveKid();
  const customization = usePreviewNavCustomization(settings.navCustomization);
  const items = useAvailableNavItems();
  const policy = {
    kid: !!kid,
    showPlaylistsTab: settings.showPlaylistsTab,
    hideContent: settings.hideContent,
    locked,
    hiddenTabs,
  };
  return {
    entries: resolveSidebarNavigation(items, customization, policy),
    items,
    policy,
    customization,
    settings,
    kid,
    locked,
  };
}

type PendingNavigation = {
  view: View;
  profileId: string | null;
  player?: PlayerSrc;
  isValid?: () => boolean;
};
let pending: PendingNavigation | null = null;
const pinListeners = new Set<() => void>();
function setPending(next: PendingNavigation | null) {
  pending = next;
  pinListeners.forEach((listener) => listener());
}
function subscribePin(listener: () => void) {
  pinListeners.add(listener);
  return () => {
    pinListeners.delete(listener);
  };
}

/** Kept outside any particular sidebar so custom chrome retains the same PIN flow. */
export function PageContextNavigationDialogs() {
  const request = useSyncExternalStore(
    subscribePin,
    () => pending,
    () => null,
  );
  const { activeProfile } = useProfiles();
  const { unlock } = useParental();
  const { setView, player } = useView();
  const profileId = activeProfile?.id ?? null;
  const valid = (!request?.player || request.player === player) && request?.isValid?.() !== false;
  useEffect(() => {
    if (request && (request.profileId !== profileId || !valid)) setPending(null);
  }, [request, profileId, valid, player]);
  if (!request || request.profileId !== profileId || !valid) return null;
  return (
    <ParentalPinModal
      mode={{
        kind: "unlock",
        onCancel: () => setPending(null),
        onUnlock: () => {
          setPending(null);
          if (request.profileId === profileId && request.isValid?.() !== false)
            setView(request.view);
        },
      }}
      verify={unlock}
    />
  );
}

export function usePageContextTarget({ includePlayer = false } = {}): ContextMenuTarget | null {
  const navigation = useSidebarNavigation();
  const view = useView();
  const localBack = useSyncExternalStore(
    subscribeLocalBackCapability,
    hasLocalBackCapability,
    () => false,
  );
  const { activeProfile } = useProfiles();
  const author = useSyncExternalStore(subscribeAuthor, currentAuthor, () => null);
  const preview = useThemePreview();
  const t = useT();
  const { settings, customization, policy, kid, locked } = navigation;
  const layout = preview?.layout ?? activeLayout(settings.theme);
  const customChrome =
    layout === "custom" ? getThemeById(settings.theme.preset)?.chrome : undefined;
  const available = view.topKind !== "picker" && (view.player ? includePlayer : !view.chromeHidden);
  const page =
    view.topKind === "person"
      ? `person:${view.personId ?? ""}`
      : view.topKind === "ebook"
        ? `ebook:${view.ebookId ?? ""}`
        : view.topKind;
  const shareTarget =
    view.topKind === "person" && view.personId != null && Number.isFinite(view.personId)
      ? { type: "person", id: String(view.personId) }
      : view.topKind === "ebook" && view.ebookId?.trim()
        ? { type: "ebook", id: view.ebookId }
        : null;
  const makeActions = (): ContextAction[] => {
    const rows: ContextAction[] = [
      {
        id: "page:back",
        label: t("Back"),
        icon: <ArrowLeft size={14} />,
        disabled: !view.canGoBack && !localBack,
        run: () => {
          requestAppBack(view.canGoBack, view.goBack);
        },
        group: "navigation",
      },
    ];
    if (shareTarget)
      rows.push({
        id: `page:share:${shareTarget.type}:${shareTarget.id}`,
        label: t("Share as link"),
        icon: <Share2 size={14} />,
        group: "sharing",
        run: async () => {
          if (!(await copyText(shareDeepLink(shareTarget.type, shareTarget.id))))
            throw new Error(t("Could not copy to the clipboard."));
          emitListToast(t("Link copied"));
        },
      });
    const entries = resolveContextNavigation(navigation.items, customization, policy, customChrome);
    const destinations: ContextAction[] = entries.map(({ item, gated }) => {
      const customIcon = customChrome?.icons?.[item.id as ChromeNavId];
      const icon = (
        <ContextNavigationIcon
          item={item}
          active={view.view === item.view}
          customIcon={customIcon}
        />
      );
      return {
        id: `page:go:${item.id}`,
        label: t(item.label),
        icon: gated ? <Lock size={14} /> : icon,
        run: () => {
          if (gated) {
            const player = view.player;
            const actor = capturePlaybackActor();
            setPending({
              view: item.view,
              profileId: activeProfile?.id ?? null,
              player: player ?? undefined,
              isValid: player
                ? () => latest.current.player === player && isPlaybackActorCurrent(actor)
                : undefined,
            });
          } else view.setView(item.view);
        },
      };
    });
    if (!kid && !locked && (!author?.handle || canOpenProfile(author.handle))) {
      const actor = captureSocialActor();
      rows.push({
        id: "page:my-profile",
        label: t("Open my profile"),
        icon: <UserRound size={14} />,
        disabled: !author,
        reason: !author ? t("Sign in to Harbor to open your profile.") : undefined,
        group: "pages",
        restoreFocus: false,
        run: async () => {
          assertSocialActor(actor);
          if (!(await openMyProfile()))
            throw new Error(t("Sign in to Harbor to open your profile."));
        },
      });
    }
    if (destinations.length)
      rows.push({
        id: "page:go-to",
        label: t("Go to"),
        icon: <UiIcon name="go-to" className="size-4" />,
        children: destinations,
        submenuVariant: "navigation",
        group: "pages",
      });
    rows.push({
      id: "page:refresh",
      label: t("Refresh"),
      icon: <RefreshCw size={14} />,
      shortcut: "Ctrl+R",
      run: reloadAppWindow,
      group: "reload",
      restoreFocus: false,
    });
    return rows;
  };
  const latest = useRef({ makeActions, available, page, player: view.player });
  latest.current = { makeActions, available, page, player: view.player };
  useEffect(
    () => notifyPageNavigation(),
    [
      customization,
      settings.theme,
      settings.hideContent,
      settings.showPlaylistsTab,
      policy.hiddenTabs,
      locked,
      kid,
      page,
      view.canGoBack,
      localBack,
      available,
      customChrome,
      activeProfile?.id,
      author,
      t,
    ],
  );
  if (!available) return null;
  return {
    kind: "actions",
    scope: "page-background",
    id: `page:${page}`,
    label: t("Page actions"),
    actions: () => latest.current.makeActions(),
    isValid: () => latest.current.available && latest.current.page === page,
    subscribe: subscribePageNavigation,
  };
}

/** Explicit detail-page binding; descendants retain their own context handling. */
export function usePageBackgroundContextMenu() {
  const target = usePageContextTarget();
  const { open } = useContextMenu();
  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.target !== event.currentTarget ||
        !target ||
        target.isValid?.() === false
      )
        return;
      const content = clickedContent(event.target, contextPointerPoint(event));
      if (content.selection || content.link || content.image) return;
      open(event, target);
    },
    [open, target],
  );
}
