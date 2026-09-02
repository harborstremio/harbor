import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { AuthorIdentity } from "../../author-identity";

export function BundleDetailsStep({
  name,
  description,
  account,
  onName,
  onDescription,
}: {
  name: string;
  description: string;
  account: Author;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex max-w-[460px] flex-col gap-5">
      <Field label={t("Pack name")}>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={60}
          placeholder={t("Gilded Trophies")}
          className="h-11 rounded-md bg-canvas px-3.5 text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none transition-colors focus:bg-elevated"
        />
      </Field>
      <AuthorIdentity account={account} />
      <Field label={t("Description")} hint={t("A short line shown under the name.")}>
        <textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder={t("A warm, hand-drawn set of trophies.")}
          className="resize-none rounded-md bg-canvas px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none transition-colors focus:bg-elevated"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-subtle">{hint}</span>}
    </label>
  );
}
