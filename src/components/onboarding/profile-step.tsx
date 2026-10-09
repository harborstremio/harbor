import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { AVATAR_CATALOG, avatarUrl } from "@/lib/avatars/catalog";
import { useT } from "@/lib/i18n";
import { useJlSession } from "@/lib/jl/account/client";
import { jlProfileContext, refreshJlProfileContext, linkJlProfile, listJlProfiles, useJlLink, type JlProfile, type JlProfileContext } from "@/lib/jl/account/sync";
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
  const session = useJlSession();
  const userId = session?.userId ?? "";
  const link = useJlLink();
  const localId = activeProfile?.id ?? "";
  const [selection, setSelection] = useState<{ context: JlProfileContext; profiles: JlProfile[] } | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const accountProfiles = selection?.context.account.userId === userId && selection.context.localId === localId ? selection.profiles : [];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const context = jlProfileContext();
    listJlProfiles(context)
      .then((list) => {
        if (!cancelled) setSelection({ context, profiles: list });
      })
      .catch(() => {
        /* offline: the viewer types a name instead */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, localId]);

  const saveName = (next: string) => {
    setName(next);
    const trimmed = next.trim();
    if (!activeProfile || !trimmed) return;
    setDisplayName(trimmed);
    updateProfile(activeProfile.id, { name: trimmed });
  };

  const setAvatar = (url: string) => {
    // The primary profile reads its avatar from the settings identity on load, so set both.
    update({ harborAvatar: url });
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };
  const pickAvatar = (id: string) => setAvatar(avatarUrl(id));

  // Picking a profile that already exists on the account links this device to it.
  const pickAccountProfile = (p: JlProfile) => {
    if (!selection) return;
    try {
      linkJlProfile(p, refreshJlProfileContext(selection.context));
      // Keep subsequent selections valid after our own binding change.
      setSelection({ ...selection, context: jlProfileContext() });
      saveName(p.name);
      if (p.avatar) setAvatar(p.avatar);
      setSelectionError(null);
    } catch {
      setSelectionError("Your account or profile changed. Reopen this step to choose again.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 2 of 4 · Your profile")}
      </span>
      <h1 className="font-display text-[34px] font-medium leading-[1.08] tracking-tight text-ink">
        {t("Who's watching?")}
      </h1>
      {accountProfiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">{t("On your account")}</span>
          <div className="flex flex-wrap gap-2">
            {accountProfiles.map((p) => {
              const on = link?.profileId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickAccountProfile(p)}
                  aria-pressed={on}
                  className={`flex h-11 items-center gap-2 rounded-full border px-3 pe-4 text-[14px] transition-colors ${
                    on ? "border-accent bg-accent-soft text-ink" : "border-edge text-ink-muted hover:text-ink"
                  }`}
                >
                  {p.avatar ? (
                    <img src={p.avatar} alt="" draggable={false} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-raised text-[12px] font-semibold">
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selectionError && <p role="alert" className="text-[13px] text-danger">{t(selectionError)}</p>}
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
