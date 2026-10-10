import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { saveList } from "@/lib/social/save-list";
import { useT } from "@/lib/i18n";

type SaveState = "idle" | "saving" | "saved" | "full" | "error";

export function SaveListButton({
  handle,
  listId,
  className = "",
}: {
  handle: string;
  listId: string;
  className?: string;
}) {
  const t = useT();
  const [state, setState] = useState<SaveState>("idle");
  if (!handle || !listId) return null;

  const onSave = async () => {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      const res = await saveList(handle, listId);
      setState(res.ok ? "saved" : res.full ? "full" : "error");
    } catch {
      setState("error");
    }
  };

  const done = state === "saved";
  const bad = state === "full" || state === "error";
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={state === "saving" || done}
      aria-label={t("Save to my lists")}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition-colors ${
        done
          ? "bg-success/12 text-success ring-success/30"
          : bad
            ? "bg-danger/12 text-danger ring-danger/30"
            : "bg-elevated text-ink-muted ring-edge-soft hover:bg-raised hover:text-ink"
      } ${className}`}
    >
      {state === "saving" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : done ? (
        <Check size={14} strokeWidth={2.6} />
      ) : (
        <Plus size={14} strokeWidth={2.4} />
      )}
      {done ? t("Saved") : state === "full" ? t("List full") : state === "error" ? t("Try again") : t("Save to my lists")}
    </button>
  );
}
