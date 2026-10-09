import { useEffect } from "react";
import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";

export function MalAvatarSync() {
  const { settings } = useSettings();
  const { isConnected } = useMal();
  const { activeProfile, updateProfile } = useProfiles();

  useEffect(() => {
    if (!settings.useMalAvatar || !isConnected || !activeProfile) return;
    let live = true;
    fetchMalAvatar().then((url) => {
      if (!live || !url) return;
      if (activeProfile.avatar === url) return;
      updateProfile(activeProfile.id, { avatar: url });
    });
    return () => {
      live = false;
    };
  }, [settings.useMalAvatar, isConnected, activeProfile, updateProfile]);

  return null;
}
