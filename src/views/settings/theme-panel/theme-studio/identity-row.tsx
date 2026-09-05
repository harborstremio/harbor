import { useT } from "@/lib/i18n";

export function IdentityRow({
  name,
  blurb,
  onChange,
}: {
  name: string;
  blurb: string;
  onChange: (patch: { name?: string; blurb?: string }) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-canvas p-1.5 ring-1 ring-edge-soft transition-shadow focus-within:ring-2 focus-within:ring-accent">
      <div className="relative">
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("Name your theme")}
          className="h-11 w-full rounded-md bg-transparent px-3 pe-7 text-[19px] font-semibold tracking-tight text-ink placeholder:text-ink-subtle/70 focus:outline-none"
        />
        {!name.trim() && (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[15px] text-accent">
            *
          </span>
        )}
      </div>
      <input
        type="text"
        value={blurb}
        onChange={(e) => onChange({ blurb: e.target.value })}
        placeholder={t("One line for the picker (optional)")}
        className="h-11 w-full rounded-md bg-transparent px-3 text-[15.5px] text-ink-muted placeholder:text-ink-subtle/70 focus:outline-none"
      />
    </div>
  );
}
