import { Check } from "lucide-react";
import { useState } from "react";
import { AVATAR_CATALOG, avatarUrl } from "@/lib/avatars/catalog";
import { useT } from "@/lib/i18n";
import { isPlaceholderName, useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";

const AVATARS = AVATAR_CATALOG.flatMap((g) => g.items);

export function ProfileStep() {
  const t = useT();
  const { activeProfile, updateProfile } = useProfiles();
  const { update } = useSettings();
  const { setDisplayName } = useTogether();
  const [name, setName] = useState(() =>
    activeProfile && !isPlaceholderName(activeProfile.name) ? activeProfile.name : "",
  );
  const selectedAvatar = activeProfile?.avatar ?? null;

  const saveName = (next: string) => {
    setName(next);
    const trimmed = next.trim();
    if (!activeProfile || !trimmed) return;
    setDisplayName(trimmed);
    updateProfile(activeProfile.id, { name: trimmed });
  };

  const pickAvatar = (id: string) => {
    const url = avatarUrl(id);
    // The primary profile reads its avatar from the settings identity on load, so set both.
    update({ harborAvatar: url });
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  return (
    <div className="flex flex-col gap-5">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 1 of 3 · Your profile")}
      </span>
      <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink">
        {t("Who's watching?")}
      </h1>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">{t("Your name")}</span>
        <input
          value={name}
          onChange={(e) => saveName(e.target.value)}
          placeholder={t("Your name")}
          maxLength={40}
          autoComplete="nickname"
          className="h-12 rounded-xl border border-edge bg-canvas px-4 text-[15px] text-ink outline-none placeholder:text-ink-subtle/60 focus:border-ink-subtle"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">{t("Pick your player")}</span>
        <div className="grid grid-cols-6 gap-2.5">
          {AVATARS.map((a) => {
            const url = avatarUrl(a.id);
            const on = selectedAvatar === url;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pickAvatar(a.id)}
                aria-label={a.name}
                aria-pressed={on}
                className={`relative aspect-square overflow-hidden rounded-full ring-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-ink ${
                  on ? "ring-accent" : "ring-transparent"
                }`}
              >
                <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
                {on && (
                  <span className="absolute bottom-0 end-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-canvas">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
