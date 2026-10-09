import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { fileToFaviconWebp, uploadFavicon } from "@/lib/social/favicon";
import { useT } from "@/lib/i18n";
import type { CustomizationInput, ProfileSummary } from "../profile-types";
import { IMAGE_URL_MAX } from "./customization-types";

const inputCls =
  "w-full min-h-11 rounded-md bg-elevated px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

export function FaviconField({
  form,
  set,
  onSaved,
}: {
  form: CustomizationInput;
  set: <K extends keyof CustomizationInput>(k: K, v: CustomizationInput[K]) => void;
  onSaved?: (next: ProfileSummary) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await fileToFaviconWebp(file);
      const next = await uploadFavicon(blob);
      set("profileFavicon", next.profileFavicon ?? "");
      onSaved?.(next);
    } catch (e) {
      setError((e as Error).message || t("Could not upload favicon."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{t("Profile favicon")}</span>
        <span className="text-[12px] text-ink-subtle">
          {t("Shows in the browser tab; defaults to your avatar")}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={form.profileFavicon}
          maxLength={IMAGE_URL_MAX}
          onChange={(e) => set("profileFavicon", e.target.value)}
          className={`${inputCls} flex-1`}
          placeholder="https://example.com/icon.png"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-elevated px-3.5 text-[13px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{" "}
          {t("Upload")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
