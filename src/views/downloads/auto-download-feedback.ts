import { emitListToast } from "@/components/lists/list-toast";
import { t } from "@/lib/i18n";

export function saveAutoDownloadChange(change: () => unknown): boolean {
  try {
    change();
    return true;
  } catch {
    emitListToast(
      t("Could not save automatic download settings. Your previous settings were kept."),
      "error",
    );
    return false;
  }
}
