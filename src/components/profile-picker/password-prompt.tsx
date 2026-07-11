import { CatAvatar } from "@/components/icons/cat-avatar";
import { useT } from "@/lib/i18n";
import { verifyProfilePassword } from "@/lib/profile-password";
import { type Profile } from "@/lib/profiles";
import { Lock } from "lucide-react";

import { PinEntry } from "./pin-entry";

export function PasswordPrompt({
  profile,
  onSuccess,
  onCancel,
}: {
  profile: Profile;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  if (!profile.passwordHash) return null;
  const targetHash = profile.passwordHash;
  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="relative inline-flex">
        <span
          className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-elevated ring-[3px]"
          style={{ boxShadow: `0 0 0 3px ${profile.color}` }}
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <CatAvatar className="h-full w-full" />
          )}
        </span>
        <span className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink shadow-md ring-1 ring-edge">
          <Lock size={13} strokeWidth={2.4} />
        </span>
      </span>
      <PinEntry
        title={t("Enter {name}'s PIN", { name: profile.name })}
        subtitle={t("Profile is locked. Enter the 4-digit PIN to continue.")}
        mode="verify"
        verify={(pin) => verifyProfilePassword(pin, targetHash)}
        onComplete={onSuccess}
        onBack={onCancel}
      />
    </div>
  );
}
