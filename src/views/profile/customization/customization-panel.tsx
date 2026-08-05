import { ArrowLeft, Check, Eye } from "lucide-react";
import { useRef, useState } from "react";
import { socialPost } from "@/lib/social/client";
import type { CustomizationInput, ProfileSummary } from "../profile-types";
import { CustomizePreview } from "./customize-preview";
import { PreviewHandle } from "./preview-handle";
import { CustomizationCode } from "./customization-code";
import { CustomizationDocs } from "./customization-docs";
import { CustomizationEditors } from "./customization-editors";
import { CANVAS_DEFAULT, validateCustomization } from "./customization-types";

export function CustomizationPanel({
  summary,
  onClose,
  onSaved,
}: {
  summary: ProfileSummary;
  onClose: () => void;
  onSaved: (next: ProfileSummary) => void;
}) {
  const [form, setForm] = useState<CustomizationInput>({
    profileFont: summary.profileFont ?? "",
    profileFavicon: summary.profileFavicon ?? "",
    pageBgColor: summary.pageBgColor ?? "",
    pageBgImage: summary.pageBgImage ?? "",
    customHtml: summary.customHtml ?? "",
    customCss: summary.customCss ?? "",
    canvasHeight: summary.canvasHeight ?? CANVAS_DEFAULT,
    customEnabled: summary.customEnabled ?? false,
    hideTopBanner: summary.hideTopBanner ?? false,
    hideCardTitles: summary.hideCardTitles ?? false,
  });
  const initialForm = useRef(form);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewMounted, setPreviewMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);

  const set = <K extends keyof CustomizationInput>(k: K, v: CustomizationInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openPreview = () => {
    setPreviewMounted(true);
    setMode("preview");
  };

  const save = async () => {
    const invalid = validateCustomization(form);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      const next = await socialPost<ProfileSummary>("/social/profile/customization", {
        profileFont: form.profileFont.trim(),
        profileFavicon: form.profileFavicon.trim(),
        pageBgColor: form.pageBgColor.trim(),
        pageBgImage: form.pageBgImage.trim(),
        customHtml: form.customHtml,
        customCss: form.customCss,
        canvasHeight: form.canvasHeight,
        customEnabled: form.customEnabled,
        hideTopBanner: form.hideTopBanner,
        hideCardTitles: form.hideCardTitles,
      });
      onSaved(next);
      onClose();
    } catch (e) {
      setError((e as Error).message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const previewing = mode === "preview";

  return (
    <div className="relative h-full overflow-hidden">
      {previewMounted && (
        <div className="absolute inset-0 z-10 overflow-y-auto">
          <CustomizePreview summary={summary} form={form} />
        </div>
      )}

      <PreviewHandle visible={previewing} onClick={() => setMode("edit")} />

      <div
        aria-hidden={previewing}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "transform" && mode === "edit") {
            setPreviewMounted(false);
          }
        }}
        className="absolute inset-0 z-30 flex flex-col bg-canvas pt-20"
        style={{
          transform: previewing ? "translateY(100%)" : "translateY(0)",
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-soft bg-canvas px-6 py-3 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Back"
              className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-elevated"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-display text-[20px] text-ink">Customize profile</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={openPreview}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-elevated"
            >
              <Eye size={18} /> Preview
            </button>
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated"
            >
              Cancel
            </button>
            {(isDirty || saving) && (
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Check size={18} /> {saving ? "Saving" : "Save"}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-6 lg:px-10">
            <CustomizationEditors form={form} set={set} onSaved={onSaved} />
            <CustomizationCode form={form} set={set} />
            <CustomizationDocs />
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
