import { useState } from "react";
import { ChevronDown, Link2, Loader2 } from "lucide-react";
import { claimTheme, forgetUpload, getMyUploads } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_PRIMARY, ROW_DESC, ROW_TITLE, SettingRow } from "../../../kit";
import { RowNote } from "../../../shared";
import { SButton, SRow } from "../../../ui";
import { TextField } from "../field";

export function ClaimPanel({
  existingIds,
  onClaimed,
}: {
  existingIds: Set<string>;
  onClaimed: () => void;
}) {
  const t = useT();
  const [manualOpen, setManualOpen] = useState(false);
  const [themeId, setThemeId] = useState("");
  const [ownerToken, setOwnerToken] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localUploads = getMyUploads().filter((u) => !existingIds.has(u.id));

  const claim = async (key: string, id: string, token: string) => {
    setBusyId(key);
    setError(null);
    try {
      await claimTheme(id, token);
      forgetUpload(id);
      setThemeId("");
      setOwnerToken("");
      setManualOpen(false);
      onClaimed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const claimManual = (e: React.FormEvent) => {
    e.preventDefault();
    const id = themeId.trim().split("/").filter(Boolean).pop() ?? "";
    if (!id || !ownerToken.trim()) return;
    claim("manual", id, ownerToken.trim());
  };

  return (
    <div className="flex flex-col gap-4 rounded-md bg-surface p-5 ring-1 ring-edge-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-elevated text-ink-muted">
          <Link2 size={20} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={ROW_TITLE}>{t("Claim a theme")}</span>
          <span className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("Attach a theme you shared before creating this account.")}
          </span>
        </div>
      </div>

      {localUploads.length > 0 && (
        <div className="harbor-settings-group">
          {localUploads.map((u) => (
            <SettingRow key={u.id} label={u.name}>
              <SButton
                variant="primary"
                onClick={() => claim(u.id, u.id, u.ownerToken)}
                disabled={busyId === u.id}
              >
                {busyId === u.id && <Loader2 size={17} className="animate-spin" />}
                {t("Claim")}
              </SButton>
            </SettingRow>
          ))}
        </div>
      )}

      {manualOpen ? (
        <form onSubmit={claimManual} className="flex flex-col gap-4 border-t border-edge-soft pt-4">
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t(
              "Every theme you share gets a private owner token. On the device where you shared it, Harbor saved it automatically, so those themes show up right here to claim in one tap. To claim one from a different device, paste that token below. New shares now bind straight to your account, so you will not need this again.",
            )}
          </p>
          <TextField
            label={t("Theme link or ID")}
            value={themeId}
            onChange={setThemeId}
            placeholder="harbor.site/themes/api/t/..."
          />
          <TextField
            label={t("Owner token")}
            value={ownerToken}
            onChange={setOwnerToken}
            placeholder={t("The token from when you shared it")}
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={!themeId.trim() || !ownerToken.trim() || busyId === "manual"}
              className={ROW_ACTION_PRIMARY}
            >
              {busyId === "manual" && <Loader2 size={17} className="animate-spin" />}
              {t("Claim theme")}
            </button>
            <SButton onClick={() => setManualOpen(false)}>{t("Cancel")}</SButton>
          </div>
        </form>
      ) : (
        <div className="harbor-settings-group">
          <SRow
            title={t("Have a token from another device?")}
            onClick={() => setManualOpen(true)}
            trailing={<ChevronDown size={18} className="shrink-0 text-ink-subtle" />}
          />
        </div>
      )}

      {error && <RowNote>{error}</RowNote>}
    </div>
  );
}
