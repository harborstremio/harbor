import { useMemo, useState } from "react";
import { LogIn } from "lucide-react";
import stremioWordmark from "@/assets/stremio-wordmark.png";
import { AuthModal } from "@/components/auth-modal";
import { ContinueCard } from "@/components/continue-card";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { type LibraryItem } from "@/lib/stremio";
import { isLibraryItemWatched } from "@/lib/trakt/library-key";

type Props = {
  signedIn: boolean;
  items: LibraryItem[];
  watchedSet?: Set<string>;
  onDismiss: (item: LibraryItem) => void;
};

export function CWSection({ signedIn, items, watchedSet, onDismiss }: Props) {
  const t = useT();
  const [showAuth, setShowAuth] = useState(false);
  const rowKey = useMemo(() => {
    const first = items[0];
    return first ? `home:cw:${first._id}` : "home:cw";
  }, [items]);

  const signInButton = signedIn ? null : (
    <button
      type="button"
      onClick={() => setShowAuth(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-edge-soft px-3 py-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
    >
      <LogIn size={13} strokeWidth={2.2} />
      {t("profile.signIn")}
    </button>
  );

  const authModal = showAuth ? <AuthModal onClose={() => setShowAuth(false)} /> : null;

  if (items.length > 0) {
    return (
      <>
        <Row
          key={rowKey}
          title={t("Continue Watching")}
          min={260}
          shape="landscape"
          scrollKey="home:cw"
          headerRight={signInButton}
        >
          {items.map((item) => (
            <ContinueCard
              key={item._id}
              item={item}
              watched={watchedSet ? isLibraryItemWatched(item, watchedSet) : false}
              onDismiss={onDismiss}
            />
          ))}
        </Row>
        {authModal}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[17px] font-medium tracking-tight text-ink">{t("Continue Watching")}</h3>
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-edge px-6 py-14 text-center">
        {signedIn ? (
          <p className="text-[15.5px] leading-relaxed text-ink-muted">
            {t("Nothing in progress yet. Press Play on something.")}
          </p>
        ) : (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[15.5px] leading-relaxed text-ink-muted">
            <span>{t("Sign in to")}</span>
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="rounded-md transition-opacity hover:opacity-80"
              aria-label={t("profile.signIn")}
            >
              <img
                src={stremioWordmark}
                alt="Stremio"
                className="relative top-0.5 h-7 w-auto select-none grayscale invert"
                draggable={false}
              />
            </button>
            <span>{t("to bring in your library.")}</span>
          </p>
        )}
      </div>
      {authModal}
    </div>
  );
}
