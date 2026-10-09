import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { editGroup, groupPerms, type GroupDetail, type GroupVisibility } from "@/lib/social/groups";
import { GroupTagsInput } from "@/views/profile/group-tags-input";
import { VisibilityToggle } from "@/views/profile/group-visibility-toggle";
import { timeAgo } from "@/views/profile/profile-bits";
import { GroupCustomizer } from "./group-customizer";
import { GroupHierarchy } from "./group-hierarchy";

const DESC_MAX = 200;

export function GroupAbout({
  detail,
  busy,
  onApply,
  onDestroy,
  onOpenProfile,
}: {
  detail: GroupDetail;
  busy: boolean;
  onApply: (d: GroupDetail) => void;
  onDestroy: () => void;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const perms = groupPerms(detail);
  const [vis, setVis] = useState<GroupVisibility>(detail.visibility);
  const [tags, setTags] = useState<string[]>(detail.tags);
  const [description, setDescription] = useState(detail.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setVis(detail.visibility);
    setTags(detail.tags);
    setDescription(detail.description ?? "");
  }, [detail]);

  const dirty =
    vis !== detail.visibility ||
    tags.join("|") !== detail.tags.join("|") ||
    description.trim() !== (detail.description ?? "").trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onApply(await editGroup(detail.id, { visibility: vis, tags, description: description.trim() }));
    } catch (e) {
      setError((e as Error).message || t("Could not save changes."));
    } finally {
      setSaving(false);
    }
  };

  if (!perms.editGroup) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
          <Field label={t("About")}>
            <p className="text-[14px] leading-relaxed text-ink-muted">
              {detail.description || t("This group has not written a description yet.")}
            </p>
          </Field>
          <Field label={t("Created")}>
            <p className="text-[13.5px] text-ink-muted">{timeAgo(detail.createdAt)}</p>
          </Field>
          {detail.tags.length > 0 && (
            <Field label={t("Tags")}>
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((tg) => (
                  <span key={tg} className="rounded-full bg-elevated px-2.5 py-1 text-[11.5px] font-medium text-ink-muted">
                    {tg}
                  </span>
                ))}
              </div>
            </Field>
          )}
        </div>
        <GroupHierarchy detail={detail} onOpenProfile={onOpenProfile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
        <Field label={t("Description")}>
          <textarea
            value={description}
            maxLength={DESC_MAX}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("What is this group about?")}
            className="w-full resize-none rounded-md bg-elevated px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft transition-shadow placeholder:text-ink-subtle focus:ring-edge"
          />
          <span className="self-end text-[11.5px] tabular-nums text-ink-subtle">{DESC_MAX - description.length}</span>
        </Field>
        <Field label={t("Who can join")}>
          <VisibilityToggle value={vis} onChange={setVis} />
        </Field>
        <Field label={t("Tags")}>
          <GroupTagsInput tags={tags} onChange={setTags} />
        </Field>
        {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
        {dirty && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex h-10 w-fit items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} {t("Save changes")}
          </button>
        )}
      </div>

      <GroupHierarchy detail={detail} onOpenProfile={onOpenProfile} />

      <GroupCustomizer detail={detail} onApply={onApply} />

      {perms.deleteGroup && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/25 bg-danger/[0.06] p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-ink">{t("Delete this group")}</span>
          <span className="text-[12.5px] text-ink-subtle">{t("Everyone loses access. This cannot be undone.")}</span>
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex h-10 items-center rounded-full px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {t("Keep")}
            </button>
            <button
              type="button"
              onClick={onDestroy}
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-full bg-danger px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} {t("Delete")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:text-danger hover:ring-danger/40"
          >
            <Trash2 size={15} /> {t("Delete group")}
          </button>
        )}
      </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{label}</span>
      {children}
    </div>
  );
}
