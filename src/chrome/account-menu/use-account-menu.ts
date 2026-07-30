import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useView } from "@/lib/view";
import { useProfiles, type Profile } from "@/lib/profiles";
import { currentAuthor, subscribeAuthor, type Author } from "@/lib/theme-auth";
import { currentStatus, setStatus, subscribeStatus, type PresenceStatus } from "@/lib/social/presence";
import { fetchMe } from "@/lib/account/identity";
import { openNotificationCenter } from "@/lib/social/notification-open";

export function useAccountMenu() {
  const { user, signOut } = useAuth();
  const { openProfile } = useView();
  const { profiles, activeProfile, openPicker, selectProfile } = useProfiles();
  const [author, setAuthor] = useState<Author | null>(currentAuthor);
  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);
  const [status, setStatusState] = useState<PresenceStatus>(currentStatus);
  useEffect(() => subscribeStatus(() => setStatusState(currentStatus())), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<Profile | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) setManageOpen(false);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && !statusOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, statusOpen]);

  const doSwitch = (p: Profile) => {
    if (p.passwordHash) openPicker({ kind: "unlock", profileId: p.id });
    else selectProfile(p.id);
  };

  const requestSwitch = (p: Profile) => {
    setMenuOpen(false);
    if (activeProfile?.kid?.parentPinHash) {
      setPendingSwitch(p);
      return;
    }
    doSwitch(p);
  };

  const viewMyProfile = async () => {
    setMenuOpen(false);
    let handle = currentAuthor()?.handle || author?.handle;
    if (!handle) {
      await fetchMe().catch(() => {});
      handle = currentAuthor()?.handle;
    }
    if (handle) openProfile(handle);
    else setAuthOpen(true);
  };

  const toggleStatus = () => {
    setMenuOpen(false);
    setStatusOpen((o) => !o);
  };

  const pickStatus = (s: PresenceStatus) => {
    setStatus(s);
    setStatusOpen(false);
  };

  const openNotifications = () => {
    setMenuOpen(false);
    openNotificationCenter();
  };

  return {
    ref,
    user,
    signOut,
    profiles,
    activeProfile,
    openPicker,
    author,
    status,
    menuOpen,
    setMenuOpen,
    statusOpen,
    setStatusOpen,
    manageOpen,
    setManageOpen,
    authOpen,
    setAuthOpen,
    pendingSwitch,
    setPendingSwitch,
    selectProfile,
    requestSwitch,
    viewMyProfile,
    toggleStatus,
    pickStatus,
    openNotifications,
  };
}

export type AccountMenuController = ReturnType<typeof useAccountMenu>;
