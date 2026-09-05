import { ROW_ACTION_PRIMARY, ROW_DESC, SettingRow } from "../kit";
import { SButton } from "../ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Fingerprint, LogIn, LogOut, UserRound } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";

export function StremioCard() {
  const t = useT();
  const { user, signOut } = useAuth();
  const [reveal, setReveal] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const signInRef = useRef<HTMLButtonElement>(null);
  const returnRing = useRef(false);

  useEffect(() => {
    if (user || !returnRing.current) return;
    returnRing.current = false;
    if (signInRef.current) tvFocus(signInRef.current);
  }, [user]);

  const onSignOut = () => {
    const active = document.activeElement;
    returnRing.current = active instanceof HTMLElement && navOwnsFocus(active);
    signOut();
  };

  const maskedEmail = useMemo(() => {
    if (!user?.email) return "";
    const [local, domain] = user.email.split("@");
    if (!domain) return "*****";
    return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 4))}@${domain}`;
  }, [user]);

  if (!user) {
    return (
      <>
        <SettingRow
          icon={<LogIn size={18} strokeWidth={2} />}
          label={t("Not signed in")}
          desc={t("Sign in to sync your library, watch progress, and addons.")}
        >
          <button
            ref={signInRef}
            type="button"
            onClick={() => setShowAuth(true)}
            className={ROW_ACTION_PRIMARY}
          >
            {t("Sign in")}
          </button>
        </SettingRow>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  return (
    <>
      <SettingRow
        icon={<UserRound size={18} strokeWidth={2} />}
        label={t("Signed in")}
        desc={
          <span className="font-mono text-ink" dir="ltr">
            {reveal ? user.email : maskedEmail}
          </span>
        }
      >
        <SButton onClick={() => setReveal((v) => !v)}>{reveal ? t("Hide") : t("Reveal")}</SButton>
        <SButton onClick={() => setShowAuth(true)}>{t("Re-authenticate")}</SButton>
      </SettingRow>

      <SettingRow
        icon={<Fingerprint size={18} strokeWidth={2} />}
        label={t("Stremio ID")}
        desc={t("The account identifier Stremio uses for your library and addon collection.")}
      >
        <span className={`break-all font-mono ${ROW_DESC}`} dir="ltr">
          {user._id}
        </span>
      </SettingRow>

      <SettingRow
        icon={<LogOut size={18} strokeWidth={2} />}
        label={t("Sign out of Stremio")}
        desc={t("Stops syncing on this device. Your library stays safe in your Stremio account.")}
      >
        <SButton variant="danger" onClick={onSignOut}>
          {t("Sign out")}
        </SButton>
      </SettingRow>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
