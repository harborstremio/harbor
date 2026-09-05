import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { AuthorIdentity } from "../../author-identity";

const FIELD_INPUT =
  "rounded-md bg-canvas px-3.5 text-[15.5px] leading-[22px] text-ink transition-colors placeholder:text-ink-subtle focus:bg-elevated focus:outline-none";

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
    <div className="flex max-w-[520px] flex-col gap-6">
      <Field label={t("Pack name")}>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={60}
          placeholder={t("Gilded Trophies")}
          className={`h-11 ${FIELD_INPUT}`}
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
          className={`min-h-11 resize-none py-2.5 ${FIELD_INPUT}`}
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
    <label className="flex flex-col gap-2">
      <span className="harbor-settings-label">{label}</span>
      {children}
      {hint && (
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">{hint}</span>
      )}
    </label>
  );
}
