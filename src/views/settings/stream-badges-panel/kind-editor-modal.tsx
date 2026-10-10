import { useEffect, useId, useRef, useState } from "react";
import { Upload } from "../icons";
import { badgeLabel, FormatBadge, type BadgeKind } from "@/components/format-badge";
import { emitListToast } from "@/components/lists/list-toast";
import { setBadgeOverride, useBadgeState } from "@/lib/stream-badges";
import { tvFocus } from "@/lib/keyboard-navigation";
import { useT } from "@/lib/i18n";
import { ModalButton, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, SettingsModal } from "../kit";
import { ROW_DESC } from "../shared";
import { handoffFocus, ringActive } from "./focus-handoff";

const MAX_UPLOAD_BYTES = 260_000;

const FIELD =
  "h-11 min-w-0 rounded-[10px] border border-edge-soft bg-canvas px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const FIELD_LABEL = "harbor-settings-label";

export function KindEditorModal({ kind, onClose }: { kind: BadgeKind; onClose: () => void }) {
  const t = useT();
  const state = useBadgeState();
  const override = state.overrides[kind];
  const [url, setUrl] = useState(override?.image ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  useEffect(() => {
    const el = urlRef.current;
    if (!el) return;
    if (ringActive()) tvFocus(el);
    else el.focus({ preventScroll: true });
  }, []);

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
      <div
        data-tv-skip
        className="grid min-h-[112px] place-items-center rounded-[10px] bg-elevated px-4 py-6"
      >
        <FormatBadge kind={kind} size="lg" />
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor={fieldId} className={FIELD_LABEL}>
          {t("Image address")}
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            id={fieldId}
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/badge.png"
            spellCheck={false}
            className={`${FIELD} min-w-[240px] flex-1`}
          />
          <button
            type="button"
            onClick={() => {
              const v = url.trim();
              if (!/^https?:\/\//.test(v) && !v.startsWith("data:image/")) {
                emitListToast(t("That doesn't look like an image URL"));
                return;
              }
              setBadgeOverride(kind, { image: v });
              emitListToast(t("Badge updated"));
            }}
            className={ROW_ACTION_PRIMARY}
          >
            {t("Apply")}
          </button>
        </div>
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t("Paste a link to a png, webp, or svg. Harbor will use it for this badge everywhere streams show format chips.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ModalButton ghost onClick={() => fileRef.current?.click()}>
          <span className="inline-flex items-center gap-2">
            <Upload size={18} />
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
            type="button"
            onClick={() =>
              handoffFocus(() => {
                setBadgeOverride(kind, null);
                setUrl("");
              }, urlRef.current)
            }
            className={ROW_ACTION_DANGER}
          >
            {t("Reset to default")}
          </button>
        )}
      </div>
      <p className={`max-w-[70ch] ${ROW_DESC}`}>
        {t("Uploads stay on this computer. Keep the file under 250 KB.")}
      </p>
    </SettingsModal>
  );
}
