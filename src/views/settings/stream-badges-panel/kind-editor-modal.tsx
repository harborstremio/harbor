import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { badgeLabel, FormatBadge, type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { setBadgeOverride, useBadgeState } from "@/lib/stream-badges";
import { useT } from "@/lib/i18n";
import { ModalButton, SettingsModal } from "../kit";

const MAX_UPLOAD_BYTES = 260_000;

export function KindEditorModal({ kind, onClose }: { kind: BadgeKind; onClose: () => void }) {
  const t = useT();
  const state = useBadgeState();
  const override = state.overrides[kind];
  const [url, setUrl] = useState(override?.image ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      emitListToast(t("Image too large. Keep badge files under 250 KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (data.startsWith("data:image/")) {
        setBadgeOverride(kind, { image: data });
        setUrl("");
        emitListToast(t("Badge updated"));
      }
    };
    reader.readAsDataURL(f);
  };

  return (
    <SettingsModal
      open
      onClose={onClose}
      title={badgeLabel(kind)}
      sub={override?.image ? t("Custom art") : override?.hidden ? t("Hidden") : t("Default art")}
    >
      <div className="grid min-h-[96px] place-items-center rounded-md bg-elevated px-4 py-6">
        <FormatBadge kind={kind} size="lg" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("Paste an image URL (png, webp, svg)")}
          className="h-10 min-w-0 flex-1 rounded-md bg-canvas px-3.5 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
        />
        <button
          onClick={() => {
            const v = url.trim();
            if (!/^https?:\/\//.test(v) && !v.startsWith("data:image/")) {
              emitListToast(t("That doesn't look like an image URL"));
              return;
            }
            setBadgeOverride(kind, { image: v });
            emitListToast(t("Badge updated"));
          }}
          className="harbor-press-pop h-10 shrink-0 rounded-md bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Apply")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ModalButton ghost onClick={() => fileRef.current?.click()}>
          <span className="inline-flex items-center gap-2">
            <Upload size={14} />
            {t("Upload image")}
          </span>
        </ModalButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <ModalButton
          ghost
          onClick={() => setBadgeOverride(kind, override?.hidden ? null : { hidden: true })}
        >
          {override?.hidden ? t("Show badge") : t("Hide badge")}
        </ModalButton>
        {(override?.image || override?.hidden) && (
          <button
            onClick={() => {
              setBadgeOverride(kind, null);
              setUrl("");
            }}
            className="h-9 rounded-md px-4 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Reset to default")}
          </button>
        )}
      </div>
    </SettingsModal>
  );
}
