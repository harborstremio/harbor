import { ProfileTile } from "@/components/profile-picker/profile-tile";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { Plus } from "lucide-react";

export function ProfilesStrip() {
  const t = useT();
  const { profiles, openPicker, selectProfile } = useProfiles();
  const switchTo = (id: string, locked: boolean) =>
    locked ? openPicker({ kind: "unlock", profileId: id }) : selectProfile(id);
  const solo = profiles.length <= 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-5">
        {profiles.map((p) => (
          <ProfileTile
            key={p.id}
            profile={p}
            size="md"
            onSelect={() => switchTo(p.id, !!p.passwordHash)}
            onEdit={() => openPicker({ kind: "edit", profileId: p.id })}
          />
        ))}
        <button
          type="button"
          onClick={() => openPicker({ kind: "create" })}
          className="group flex flex-col items-center gap-2"
          aria-label={t("Add profile")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-edge-soft text-ink-subtle transition-colors group-hover:border-ink-subtle group-hover:text-ink">
            <Plus size={22} strokeWidth={2.2} />
          </span>
          <span className="text-[12px] font-medium text-ink-subtle transition-colors group-hover:text-ink">
            {t("Add")}
          </span>
        </button>
      </div>
      {solo ? (
        <p className="max-w-md text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Add a profile for someone else and everyone keeps their own Continue Watching, watch history, and progress.",
          )}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => openPicker({ kind: "list" })}
          className="flex h-9 w-fit items-center rounded-lg border border-edge-soft px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          {t("Switch profile")}
        </button>
      )}
    </div>
  );
}
