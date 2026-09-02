import { useState } from "react";
import { Info, Link2, Loader2 } from "lucide-react";
import { claimTheme, forgetUpload, getMyUploads } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { TextField } from "../field";

function TokenTip() {
  const t = useT();
  return (
    <span className="group/tip relative inline-flex cursor-help items-center">
      <Info
        size={14}
        strokeWidth={2.2}
        className="text-ink-subtle transition-colors group-hover/tip:text-ink-muted"
      />
      <span className="pointer-events-none absolute bottom-full start-1/2 z-20 mb-2 w-72 -translate-x-1/2 rounded-md bg-elevated px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-muted opacity-0 harbor-float transition-opacity duration-150 group-hover/tip:opacity-100">
        {t(
          "Every theme you share gets a private owner token. On the device where you shared it, Harbor saved it automatically, so those themes show up right here to claim in one tap. To claim one from a different device, paste that token below. New shares now bind straight to your account, so you will not need this again.",
        )}
      </span>
    </span>
  );
}

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
    <div className="flex flex-col gap-3 rounded-md bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-elevated text-ink-muted">
          <Link2 size={18} strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            {t("Claim a theme")}
            <TokenTip />
          </span>
          <span className="text-[12.5px] text-ink-subtle">
            {t("Attach a theme you shared before creating this account.")}
          </span>
        </div>
      </div>

      {localUploads.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {localUploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-md bg-elevated px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {u.name}
              </span>
              <button
                onClick={() => claim(u.id, u.id, u.ownerToken)}
                disabled={busyId === u.id}
                className="flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busyId === u.id && <Loader2 size={14} className="animate-spin" />} {t("Claim")}
              </button>
            </div>
          ))}
        </div>
      )}

      {manualOpen ? (
        <form onSubmit={claimManual} className="flex flex-col gap-3 border-t border-edge-soft pt-3">
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
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!themeId.trim() || !ownerToken.trim() || busyId === "manual"}
              className="flex h-10 items-center gap-1.5 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busyId === "manual" && <Loader2 size={14} className="animate-spin" />}{" "}
              {t("Claim theme")}
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="h-10 rounded-md px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setManualOpen(true)}
          className="self-start text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {t("Have a token from another device?")}
        </button>
      )}

      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
