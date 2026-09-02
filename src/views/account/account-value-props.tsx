import { useT } from "@/lib/i18n";
import { AtSign, BadgeCheck, RefreshCw } from "lucide-react";

const PROPS = [
  { icon: AtSign, title: "Claim your @handle", body: "A name people can find you by across Harbor." },
  { icon: RefreshCw, title: "Sync everywhere", body: "Your themes, lists, and profile follow you to any device." },
  { icon: BadgeCheck, title: "Show off your taste", body: "A public profile with your stats, lists, badges, and custom styling." },
];

export function AccountValueProps() {
  const t = useT();
  return (
    <ul className="flex flex-col gap-2.5">
      {PROPS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-muted">
            <Icon size={15} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold text-ink">{t(title)}</span>
            <span className="text-[12px] leading-snug text-ink-subtle">{t(body)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
