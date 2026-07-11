import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useEffect } from "react";

export function MalAvatarSync() {
  const { settings, update } = useSettings();
  const { isConnected } = useMal();
  const { activeProfile, updateProfile } = useProfiles();

  useEffect(() => {
    if (!settings.useMalAvatar || !isConnected || !activeProfile) return;
    let live = true;
    fetchMalAvatar().then((url) => {
      if (!live || !url) return;
      if (activeProfile.avatar === url) return;
      update({ harborAvatar: url });
      updateProfile(activeProfile.id, { avatar: url });
    });
    return () => {
      live = false;
    };
  }, [settings.useMalAvatar, isConnected, activeProfile, update, updateProfile]);

  return null;
}
