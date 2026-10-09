import { ArrowDownToLine, MessageSquare, Star } from "../../../../icons";
import { useT } from "@/lib/i18n";
import type { ThemeNotification } from "@/lib/theme-store";
import { ROW_DESC, ROW_TITLE } from "@/views/settings/shared";
import { timeAgo } from "../time-ago";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function describe(n: ThemeNotification, t: Translate): { Icon: typeof Star; text: string } {
  if (n.type === "downloads")
    return { Icon: ArrowDownToLine, text: t("hit {count} downloads", { count: n.count ?? 0 }) };
  if (n.type === "stars")
    return { Icon: Star, text: t("reached {count} five-star ratings", { count: n.count ?? 0 }) };
  return {
    Icon: MessageSquare,
    text: t("{actor} left a comment", { actor: n.actor || t("Someone") }),
  };
}

export function NotificationItem({ n, onOpen }: { n: ThemeNotification; onOpen: () => void }) {
  const t = useT();
  const { Icon, text } = describe(n, t);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[68px] w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-start transition-colors hover:bg-raised"
    >
      <span className="relative grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-surface">
        {n.cover ? (
          <img src={n.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Icon size={18} className="text-ink-subtle" />
        )}
        {n.cover && (
          <span className="absolute end-0.5 bottom-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            <Icon size={11} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`line-clamp-2 ${ROW_TITLE}`}>
          <span className="font-semibold">{n.themeName}</span> {text}
        </span>
        <span className={ROW_DESC}>{timeAgo(n.createdAt)}</span>
      </span>
      {!n.read && (
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
      )}
    </button>
  );
}
