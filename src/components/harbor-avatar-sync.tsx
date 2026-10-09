import { useEffect, useState } from "react";
import { pushAvatarToEcosystem } from "@/lib/account/avatar-sync";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";

export function HarborAvatarSync() {
  const { settings } = useSettings();
  const { activeProfile } = useProfiles();
  const [author, setAuthor] = useState(currentAuthor);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  const value = activeProfile?.avatar ?? settings.harborAvatar ?? null;

  useEffect(() => {
    if (!author) return;
    void pushAvatarToEcosystem(value);
  }, [author?.id, value]);

  return null;
}
