import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowLeft, Lock, Navigation, RefreshCw, UserRound } from "lucide-react";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import type { ContextAction } from "@/lib/context-actions";
import type { ContextMenuTarget } from "@/lib/context-menu";
import {
  getPageContextRefresh,
  notifyPageContextRefresh,
  runPageContextRefresh,
  subscribePageContextRefresh,
} from "@/lib/context-page-store";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useActiveKid, useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { openMyProfile } from "@/lib/social/open-my-profile";
import { activeLayout, getThemeById, type ChromeNavId } from "@/lib/theme";
import { usePreviewNavCustomization, useThemePreview } from "@/lib/theme-preview";
import { useView, type View } from "@/lib/view";
import { iconComponent } from "@/views/settings/theme-panel/theme-studio/chrome-icons";
import { NAV_ITEMS } from "./nav-items";
import {
  customizeNavigation,
  resolveSidebarNavigation,
  visibleNavigation,
} from "./navigation-policy";

export function useSidebarNavigation() {
  const { settings } = useSettings();
  const { locked, hiddenTabs } = useParental();
  const kid = useActiveKid();
  const customization = usePreviewNavCustomization(settings.navCustomization);
  const policy = {
    kid: !!kid,
    showPlaylistsTab: settings.showPlaylistsTab,
    hideContent: settings.hideContent,
    locked,
    hiddenTabs,
  };
  return {
    entries: resolveSidebarNavigation(NAV_ITEMS, customization, policy),
    policy,
    customization,
    settings,
    kid,
    locked,
  };
}

type PendingNavigation = { view: View; profileId: string | null };
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
  const { setView } = useView();
  const profileId = activeProfile?.id ?? null;
  useEffect(() => {
    if (request && request.profileId !== profileId) setPending(null);
  }, [request, profileId]);
  if (!request || request.profileId !== profileId) return null;
  return (
    <ParentalPinModal
      mode={{
        kind: "unlock",
        onCancel: () => setPending(null),
        onUnlock: () => {
          setPending(null);
          if (request.profileId === profileId) setView(request.view);
        },
      }}
      verify={unlock}
    />
  );
}

export function usePageContextTarget(): ContextMenuTarget | null {
  const navigation = useSidebarNavigation();
  const view = useView();
  const { activeProfile } = useProfiles();
  const preview = useThemePreview();
  const t = useT();
  const { settings, customization, policy, kid, locked } = navigation;
  const layout = preview?.layout ?? activeLayout(settings.theme);
  const customChrome =
    layout === "custom" ? getThemeById(settings.theme.preset)?.chrome : undefined;
  const available = !view.player && view.topKind !== "picker" && !view.chromeHidden;
  const makeActions = (): ContextAction[] => {
    const rows: ContextAction[] = [
      {
        id: "page:back",
        label: t("Back"),
        icon: <ArrowLeft size={14} />,
        disabled: !view.canGoBack,
        run: view.goBack,
        group: "navigation",
      },
    ];
    const refresh = getPageContextRefresh(view.topKind);
    if (refresh)
      rows.push({
        id: `page:refresh:${refresh.id}`,
        label: refresh.label,
        icon: <RefreshCw size={14} />,
        disabled: !!refresh.busy,
        reason: refresh.busy ? t("This page is already refreshing.") : undefined,
        run: () => runPageContextRefresh(view.topKind, refresh.id),
        group: "navigation",
      });
    let entries = navigation.entries;
    if (customChrome) {
      const allowed = visibleNavigation(customizeNavigation(NAV_ITEMS, customization), policy);
      const byId = new Map(allowed.map((item) => [item.id as string, item]));
      entries = [...new Set(customChrome.items)].flatMap((id) => {
        const item = byId.get(id);
        if (!item) return [];
        return [
          {
            item: { ...item, label: customChrome.labels?.[id]?.trim() || item.label },
            primary: true,
            gated: !!item.pinGated && locked,
          },
        ];
      });
    }
    const destinations: ContextAction[] = entries.map(({ item, gated }) => {
      const customIcon = customChrome?.icons?.[item.id as ChromeNavId];
      const Icon = customIcon ? iconComponent(customIcon) : undefined;
      const imageIcon =
        customIcon && /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/i.test(customIcon);
      const icon = imageIcon ? (
        <img src={customIcon} alt="" className="size-4 object-contain" />
      ) : Icon ? (
        <Icon size={14} />
      ) : (
        <span className="inline-flex size-4 items-center justify-center [&>svg]:size-4 [&>span]:size-4">
          {item.render(view.view === item.view)}
        </span>
      );
      return {
        id: `page:go:${item.id}`,
        label: t(item.label),
        icon: gated ? <Lock size={14} /> : icon,
        run: () => {
          if (gated) setPending({ view: item.view, profileId: activeProfile?.id ?? null });
          else view.setView(item.view);
        },
      };
    });
    if (!kid && !locked)
      destinations.push({
        id: "page:my-profile",
        label: t("My profile"),
        icon: <UserRound size={14} />,
        run: async () => {
          if (!(await openMyProfile()))
            throw new Error(t("Sign in to Harbor to open your profile."));
        },
      });
    if (destinations.length)
      rows.push({
        id: "page:go-to",
        label: t("Go to"),
        icon: <Navigation size={14} />,
        children: destinations,
        group: "pages",
      });
    return rows;
  };
  const latest = useRef({ makeActions, available, page: view.topKind });
  latest.current = { makeActions, available, page: view.topKind };
  useEffect(
    () => notifyPageContextRefresh(),
    [
      customization,
      settings.theme,
      settings.hideContent,
      settings.showPlaylistsTab,
      policy.hiddenTabs,
      locked,
      kid,
      view.topKind,
      view.canGoBack,
      available,
      customChrome,
    ],
  );
  if (!available) return null;
  const page = view.topKind;
  return {
    kind: "actions",
    id: `page:${page}`,
    label: t("Page actions"),
    actions: () => latest.current.makeActions(),
    isValid: () => latest.current.available && latest.current.page === page,
    subscribe: subscribePageContextRefresh,
  };
}
