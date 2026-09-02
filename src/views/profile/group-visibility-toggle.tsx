import { Globe, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { GroupVisibility } from "@/lib/social/groups";

export function VisibilityToggle({
  value,
  onChange,
}: {
  value: GroupVisibility;
  onChange: (v: GroupVisibility) => void;
}) {
  const t = useT();
  const opts: Array<{ id: GroupVisibility; label: string; sub: string; icon: typeof Globe }> = [
    { id: "invite", label: t("Invite only"), sub: t("Only people you add can join"), icon: Lock },
    { id: "public", label: t("Public"), sub: t("Anyone can find and join from search"), icon: Globe },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((o) => {
        const on = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex flex-col gap-1 rounded-md border p-3 text-start transition-colors ${
              on ? "border-ink bg-surface" : "border-edge-soft bg-surface/40 hover:border-edge"
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Icon size={14} /> {o.label}
            </span>
            <span className="text-[11.5px] leading-snug text-ink-subtle">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
