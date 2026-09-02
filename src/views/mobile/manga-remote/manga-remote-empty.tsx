import { BookOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import { HarborLoader } from "@/components/harbor-loader";

export function MangaRemoteEmpty({ variant }: { variant: "closed" | "reconnecting" }) {
  const t = useT();
  if (variant === "reconnecting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <HarborLoader size="lg" />
        <p className="text-[14px] font-medium text-ink-muted">
          {t("Reconnecting to your computer")}
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-elevated text-ink-subtle">
        <BookOpen size={30} strokeWidth={1.8} />
      </span>
      <p className="text-[15px] font-semibold text-ink">{t("Reader closed on your computer")}</p>
      <p className="max-w-[240px] text-[13px] leading-relaxed text-ink-subtle">
        {t("Open a manga on Harbor to control the reader from here.")}
      </p>
    </div>
  );
}
