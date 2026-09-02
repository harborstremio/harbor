import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AccountMenuFloating } from "@/chrome/account-menu/account-menu-floating";
import { StatusPicker } from "@/chrome/sidebar/status-control";
import { NotificationCenter } from "@/components/notification-center/notification-center";
import { useAuth } from "@/lib/auth";
import { useActiveKid, useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { anchorFromElement, openAccountMenu, type AccountMenuAnchor } from "@/lib/social/account-menu-open";
import { openNotificationCenter } from "@/lib/social/notification-open";
import { currentStatus, setStatus, subscribeStatus, type PresenceStatus } from "@/lib/social/presence";
import { getUnreadCount, subscribeUnread } from "@/lib/social/unread-bridge";
import { activeLayout } from "@/lib/theme";
import { useBigPictureEntry } from "@/chrome/use-big-picture-entry";
import { useThemePreview } from "@/lib/theme-preview";

const SCAN_MS = 1200;
const STATUS_EVENT = "harbor:open-status-picker";

const STATUS_COLORS: Record<string, string> = {
  online: "var(--color-success, #22c55e)",
  away: "var(--color-accent)",
  dnd: "var(--color-danger)",
  offline: "var(--color-ink-subtle)",
};

function syncStatusSlots(): void {
  const status = currentStatus();
  const slots = document.querySelectorAll<HTMLElement>("[data-harbor-status]");
  for (const el of Array.from(slots)) {
    if (el.getAttribute("data-status") !== status) el.setAttribute("data-status", status);
    const color = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
    if (el.style.background !== color) el.style.background = color;
    if (el.style.pointerEvents !== "auto") el.style.pointerEvents = "auto";
    if (el.style.cursor !== "pointer") el.style.cursor = "pointer";
  }
}

function syncAvatarSlots(url: string | null): void {
  const slots = document.querySelectorAll<HTMLElement>("[data-harbor-avatar]");
  for (const el of Array.from(slots)) {
    if (el instanceof HTMLImageElement) {
      if (url) {
        if (el.src !== url) el.src = url;
        el.hidden = false;
        el.removeAttribute("data-empty");
      } else {
        el.hidden = true;
        el.setAttribute("data-empty", "");
      }
      continue;
    }
    const bg = url ? `url("${url}")` : "";
    if (el.style.backgroundImage !== bg) {
      el.style.backgroundImage = bg;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    }
    if (url) el.removeAttribute("data-empty");
    else el.setAttribute("data-empty", "");
  }
}

function syncUnreadSlots(count: number): void {
  const label = count > 9 ? "9+" : String(count);
  const slots = document.querySelectorAll<HTMLElement>("[data-harbor-unread]");
  for (const el of Array.from(slots)) {
    if (el.textContent !== label) el.textContent = label;
    el.setAttribute("data-count", String(count));
    if (count === 0) el.setAttribute("data-empty", "");
    else el.removeAttribute("data-empty");
  }
}

function syncBigPictureSlots(offer: boolean): void {
  const slots = document.querySelectorAll<HTMLElement>("[data-harbor-bigpicture]");
  for (const el of Array.from(slots)) {
    if (offer) el.removeAttribute("data-empty");
    else el.setAttribute("data-empty", "");
  }
}

type HarborApi = { search?: () => void; bigPicture?: () => void };

function harborApi(): HarborApi | undefined {
  return (window as unknown as { harbor?: HarborApi }).harbor;
}

function StatusPickerFloating() {
  const [anchor, setAnchor] = useState<AccountMenuAnchor | null>(null);
  const [current, setCurrent] = useState<PresenceStatus>(currentStatus);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeStatus(() => setCurrent(currentStatus())), []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<AccountMenuAnchor>).detail;
      setAnchor(detail ?? { bottom: 76, right: window.innerWidth - 18 });
    };
    window.addEventListener(STATUS_EVENT, onOpen);
    return () => window.removeEventListener(STATUS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchor(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  if (!anchor) return null;
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 120);
  const end = Math.max(12, window.innerWidth - anchor.right);

  return createPortal(
    <div ref={wrapRef} className="fixed z-[165] w-64" style={{ top, insetInlineEnd: end }}>
      <div className="relative">
        <StatusPicker
          current={current}
          placement="down"
          align="end"
          onPick={(s) => {
            setStatus(s);
            setAnchor(null);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

export function ThemeChromeBridge() {
  const { settings } = useSettings();
  const kid = useActiveKid();
  const preview = useThemePreview();
  const { activeProfile } = useProfiles();
  const { user } = useAuth();
  const harborAvatar = settings.harborAvatar?.startsWith("/kids/avatars/") ? null : settings.harborAvatar;
  const avatarUrl = activeProfile?.avatar ?? harborAvatar ?? user?.avatar ?? null;
  const avatarRef = useRef(avatarUrl);
  avatarRef.current = avatarUrl;
  const bpOffer = useBigPictureEntry().offer;
  const bpOfferRef = useRef(bpOffer);
  bpOfferRef.current = bpOffer;

  useEffect(() => syncAvatarSlots(avatarUrl), [avatarUrl]);

  useEffect(() => syncBigPictureSlots(bpOffer), [bpOffer]);

  useEffect(() => {
    document.documentElement.setAttribute("data-harbor-bridge", "1");
    return () => document.documentElement.removeAttribute("data-harbor-bridge");
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const statusDot = t.closest("[data-harbor-status]");
      if (statusDot) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent(STATUS_EVENT, { detail: anchorFromElement(statusDot) }),
        );
        return;
      }
      const bell = t.closest("[data-harbor-notifications]");
      if (bell) {
        e.preventDefault();
        e.stopPropagation();
        openNotificationCenter();
        return;
      }
      const account = t.closest("[data-harbor-account]");
      if (account) {
        if (account.getAttribute("data-harbor-account") === "own") return;
        e.preventDefault();
        e.stopPropagation();
        openAccountMenu(anchorFromElement(account));
        return;
      }
      const search = t.closest("[data-harbor-search]");
      if (search && !search.closest(".harbor-search-pill")) {
        e.preventDefault();
        e.stopPropagation();
        harborApi()?.search?.();
        return;
      }
      const bigPicture = t.closest("[data-harbor-bigpicture]");
      if (bigPicture) {
        e.preventDefault();
        e.stopPropagation();
        harborApi()?.bigPicture?.();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const stop = subscribeUnread(syncUnreadSlots);
    const stopStatus = subscribeStatus(syncStatusSlots);
    syncStatusSlots();
    const iv = window.setInterval(() => {
      syncUnreadSlots(getUnreadCount());
      syncStatusSlots();
      syncAvatarSlots(avatarRef.current);
      syncBigPictureSlots(bpOfferRef.current);
    }, SCAN_MS);
    return () => {
      stop();
      stopStatus();
      window.clearInterval(iv);
    };
  }, []);

  const layout = kid ? "sidebar" : preview ? preview.layout : activeLayout(settings.theme);
  const custom = layout === "custom";

  return (
    <>
      {custom ? <NotificationCenter trigger={false} /> : null}
      <AccountMenuFloating />
      <StatusPickerFloating />
    </>
  );
}
