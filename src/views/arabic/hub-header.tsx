import { useT } from "@/lib/i18n";

export function HubHeader({ rtl }: { rtl: boolean }) {
  const t = useT();
  return (
    <header
      dir={rtl ? "rtl" : "ltr"}
      className="relative overflow-hidden rounded-2xl border border-edge-soft bg-surface/60 px-10 py-9"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(120% 140% at 100% 0%, var(--color-accent-soft), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-2">
        <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight text-ink">
          {t("arabic.hub.title")}
        </h1>
        <p className="text-[13.5px] text-ink-muted">
          <bdi>{t("Ramadan series, drama, films, Egyptian classics, and Gulf - all in one place.")}</bdi>
        </p>
      </div>
    </header>
  );
}
