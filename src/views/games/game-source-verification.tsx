import { Globe, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { sourceNeedsVerification, sourceVerificationAvailable } from "@/lib/games/source-verification";

export function SourceVerificationControl({ error, busy, verifying, onVerify, onCancel }: {
  error?: string; busy: boolean; verifying: boolean; onVerify: () => void; onCancel: () => void;
}) {
  const t = useT();
  if (!verifying && (!sourceNeedsVerification(error) || !sourceVerificationAvailable())) return null;
  return <div className="games-source-verification">
    {verifying && <p role="status">{t("games.sources.verification.waiting")}</p>}
    <button type="button" className="games-button" disabled={busy && !verifying} onClick={verifying ? onCancel : onVerify}>
      {verifying ? <X size={16} aria-hidden="true"/> : <Globe size={16} aria-hidden="true"/>}
      {t(verifying ? "common.cancel" : busy ? "games.sources.checking" : "games.sources.verification.action")}
    </button>
  </div>;
}
