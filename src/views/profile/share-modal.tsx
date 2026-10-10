import { Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { CopyRow } from "./share-modal/copy-row";
import { DiscordIcon, FacebookIcon, RedditIcon, WhatsappIcon, XIcon } from "./share-modal/share-icons";
import { embedFields, socialUrls } from "./share-modal/share-targets";

type Tab = "link" | "embed";

export type ShareTarget = {
  heading: string;
  linkLabel: string;
  url: string;
  cardUrl: string;
  text: string;
  name: string;
};

export function ShareModal({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("link");
  const [discordCopied, setDiscordCopied] = useState(false);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const socials = socialUrls(target.url, target.text);
  const embeds = embedFields(target.url, target.cardUrl, target.name);

  const copyForDiscord = async () => {
    try {
      await navigator.clipboard.writeText(target.url);
      setDiscordCopied(true);
      window.setTimeout(() => setDiscordCopied(false), 1500);
    } catch {
      setDiscordCopied(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="animate-modal-in flex w-[min(94vw,440px)] flex-col rounded-xl bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft"
      >
        <div className="flex items-center justify-between gap-3 border-b border-edge-soft px-5 py-4">
          <h2 className="font-display text-[19px] text-ink">{target.heading}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          <TabButton active={tab === "link"} onClick={() => setTab("link")}>
            {t("Link and social")}
          </TabButton>
          <TabButton active={tab === "embed"} onClick={() => setTab("embed")}>
            {t("Embed")}
          </TabButton>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          {tab === "link" ? (
            <>
              <CopyRow label={target.linkLabel} value={target.url} primary />
              <div className="grid grid-cols-3 gap-2">
                <ShareButton label="X" onClick={() => openUrl(socials.x)}>
                  <XIcon size={17} />
                </ShareButton>
                <ShareButton label="Reddit" onClick={() => openUrl(socials.reddit)}>
                  <RedditIcon size={18} />
                </ShareButton>
                <ShareButton label="Facebook" onClick={() => openUrl(socials.facebook)}>
                  <FacebookIcon size={18} />
                </ShareButton>
                <ShareButton label="WhatsApp" onClick={() => openUrl(socials.whatsapp)}>
                  <WhatsappIcon size={18} />
                </ShareButton>
                <ShareButton label={t("Email")} onClick={() => openUrl(socials.email)}>
                  <Mail size={17} />
                </ShareButton>
                <ShareButton
                  label={discordCopied ? t("Copied for Discord") : t("Copy for Discord")}
                  active={discordCopied}
                  onClick={() => void copyForDiscord()}
                >
                  <DiscordIcon size={18} />
                </ShareButton>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3.5">
              {embeds.map((f) => (
                <CopyRow key={f.key} label={f.label} value={f.value} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md px-3 text-[13px] font-medium transition-colors ${
        active ? "bg-elevated text-ink ring-1 ring-edge-soft" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ShareButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md px-2 py-2 ring-1 transition-colors ${
        active ? "bg-accent/15 text-accent ring-accent/40" : "bg-elevated text-ink ring-edge-soft hover:bg-raised"
      }`}
    >
      {children}
      <span className="text-center text-[11.5px] font-medium leading-tight">{label}</span>
    </button>
  );
}
