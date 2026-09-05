import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth-modal";
import { useT } from "@/lib/i18n";
import { openMyProfile } from "@/lib/social/open-my-profile";
import { currentAuthor, subscribeAuthor, type Author } from "@/lib/theme-auth";

export function ProfileButton() {
  const t = useT();
  const [author, setAuthor] = useState<Author | null>(currentAuthor);
  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);
  const [authOpen, setAuthOpen] = useState(false);

  if (!author) return null;

  const label = t("View my profile");
  const go = async () => {
    if (!(await openMyProfile(author.handle))) setAuthOpen(true);
  };

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => void go()}
        className="harbor-navbtn relative flex h-11 w-11 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted transition-[color,background-color,transform] duration-150 ease-out hover:bg-elevated hover:text-ink active:scale-[0.98] motion-reduce:transition-none"
      >
        <UserRound size={17} strokeWidth={1.9} />
      </button>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}
