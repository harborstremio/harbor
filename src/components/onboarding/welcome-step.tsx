import jlWordmark from "@/assets/brand/jl-wordmark-white.webp";
import { useT } from "@/lib/i18n";

export function WelcomeStep() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <img src={jlWordmark} alt="JL Media Vision" draggable={false} className="h-14 w-auto self-start object-contain" />
        <p className="text-[15.5px] leading-relaxed text-ink-muted">
          {t(
            "Live TV, sports, movies and shows in one place. A few minutes to set up, most of it optional. You stay in control of every key.",
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <Bullet title={t("Live")}>{t("Your IPTV channels, the guide, and the Sports Hub.")}</Bullet>
        <Bullet title={t("Yours")}>{t("Your provider, your debrid service, your addons.")}</Bullet>
        <Bullet title={t("Synced")}>{t("Sign in to keep favorites the same on every device.")}</Bullet>
      </div>
    </div>
  );
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-edge-soft bg-canvas/60 p-4">
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink">
        {title}
      </span>
      <span className="text-[12.5px] leading-snug text-ink-muted">{children}</span>
    </div>
  );
}
