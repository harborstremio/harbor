import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ROLE_RANK, type GroupRole } from "@/lib/social/groups";
import { roleLabel } from "./role-badge";

const DESCRIPTION: Record<GroupRole, string> = {
  owner: "Full control of the group",
  admin: "Can manage members and posts",
  manager: "Can post, moderate and invite",
  member: "Can post and take part",
};

export function MemberRoleMenu({
  role,
  myRank,
  busy,
  onPick,
}: {
  role: GroupRole;
  myRank: number;
  busy: boolean;
  onPick: (next: GroupRole) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: GroupRole[] = myRank >= ROLE_RANK.owner ? ["admin", "manager", "member"] : ["manager", "member"];

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : t(roleLabel(role))}
        {!busy && <ChevronDown size={13} strokeWidth={2.4} />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-1 w-[228px] overflow-hidden rounded-[12px] border border-edge bg-elevated/95 p-1 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (opt !== role) onPick(opt);
              }}
              className="flex w-full items-start gap-2 rounded-[8px] px-2.5 py-2 text-start transition-colors hover:bg-raised"
            >
              <span className="mt-0.5 w-3.5 shrink-0">
                {opt === role && <Check size={14} strokeWidth={2.6} className="text-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-ink">{t(roleLabel(opt))}</span>
                <span className="block text-[11.5px] leading-snug text-ink-subtle">{t(DESCRIPTION[opt])}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
