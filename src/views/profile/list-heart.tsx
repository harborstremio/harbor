import { Heart } from "lucide-react";
import { useState } from "react";
import { likeList, unlikeList } from "@/lib/social/list-likes";
import { useT } from "@/lib/i18n";

export function ListHeart({
  handle,
  listId,
  count,
  liked,
  interactive,
  className = "",
}: {
  handle: string;
  listId: string;
  count: number;
  liked: boolean;
  interactive: boolean;
  className?: string;
}) {
  const t = useT();
  const [on, setOn] = useState(liked);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);
  const canInteract = interactive && !!handle && !!listId;

  const toggle = async () => {
    if (busy) return;
    const prevOn = on;
    const prevN = n;
    const next = !prevOn;
    setOn(next);
    setN(Math.max(0, prevN + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = next ? await likeList(handle, listId) : await unlikeList(handle, listId);
      setOn(res.liked);
      setN(res.likeCount);
    } catch {
      setOn(prevOn);
      setN(prevN);
    } finally {
      setBusy(false);
    }
  };

  if (!canInteract) {
    return (
      <span className={`inline-flex items-center gap-1 text-[12px] tabular-nums text-ink-subtle ${className}`}>
        <Heart size={13} strokeWidth={2} className={on ? "fill-current text-danger" : ""} />
        {n}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? t("Unlike list") : t("Like list")}
      className={`group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold tabular-nums ring-1 transition-colors ${
        on
          ? "bg-danger/12 text-danger ring-danger/25"
          : "bg-elevated text-ink-muted ring-edge-soft hover:bg-raised hover:text-ink"
      } ${className}`}
    >
      <Heart
        size={14}
        strokeWidth={2.2}
        className={`transition-transform duration-200 group-active:scale-90 ${on ? "fill-current" : ""}`}
      />
      {n}
    </button>
  );
}
