import { Check, Lock, Pencil, Plus } from "lucide-react";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../shared";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const CELL =
  "relative flex flex-col items-center gap-3 rounded-[10px] border bg-canvas p-4 transition-colors";

export function ProfilesStrip() {
  const t = useT();
  const { profiles, activeProfile, openPicker, selectProfile } = useProfiles();
  const switchTo = (id: string, locked: boolean) =>
    locked ? openPicker({ kind: "unlock", profileId: id }) : selectProfile(id);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {profiles.map((p) => {
        const active = activeProfile?.id === p.id;
        const locked = !!p.passwordHash;
        return (
          <div
            key={p.id}
            className={`group ${CELL} ${active ? "border-accent" : "border-edge-soft hover:bg-elevated"}`}
          >
            <button
              type="button"
              onClick={() =>
                active ? openPicker({ kind: "edit", profileId: p.id }) : switchTo(p.id, locked)
              }
              aria-label={
                active ? t("Edit {name}", { name: p.name }) : t("Switch to {name}", { name: p.name })
              }
              className="flex w-full flex-col items-center gap-3 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="relative">
                <span
                  className="block shrink-0 rounded-full p-[3px] transition-transform duration-200 group-hover:scale-[1.03]"
                  style={{ background: p.color }}
                >
                  <span className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-elevated">
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <CatAvatar className="h-full w-full" />
                    )}
                  </span>
                </span>
                {locked && (
                  <span className="absolute -bottom-0.5 -end-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-canvas text-ink">
                    <Lock size={12} strokeWidth={2.4} />
                  </span>
                )}
              </span>
              <span className="flex w-full flex-col items-center gap-2">
                <span className={`max-w-full text-center ${ROW_TITLE}`}>
                  {p.name}
                </span>
                <span className="flex min-h-[22px] items-center">
                  {active ? (
                    <span className={`${QUAL} bg-accent-soft text-accent`}>
                      <Check size={13} strokeWidth={3} />
                      {t("Active")}
                    </span>
                  ) : p.isPrimary ? (
                    <span className={`${QUAL} bg-elevated text-ink-subtle`}>
                      {t("profile.primary")}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openPicker({ kind: "edit", profileId: p.id })}
              aria-label={t("Edit {name}", { name: p.name })}
              className="absolute end-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              <Pencil size={18} strokeWidth={2.2} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => openPicker({ kind: "create" })}
        aria-label={t("Add profile")}
        className={`${CELL} justify-center border-edge-soft text-ink-subtle hover:bg-elevated hover:text-ink`}
      >
        <span className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-elevated">
          <Plus size={26} strokeWidth={2.2} />
        </span>
        <span className={ROW_TITLE}>{t("Add")}</span>
        <span className="min-h-[22px]" />
      </button>
    </div>
  );
}
