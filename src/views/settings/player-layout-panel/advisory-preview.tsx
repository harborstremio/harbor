import { ContentAdvisoryToast, type Advisory } from "@/components/player/content-advisory-toast";
import { useT } from "@/lib/i18n";
import { useSampleArtwork } from "@/lib/sample-artwork";

const SAMPLE: Advisory[] = [
  { category: "Violence", severity: "Severe" },
  { category: "Profanity", severity: "Moderate" },
  { category: "Frightening", severity: "Mild" },
];

export function AdvisoryPreview() {
  const t = useT();
  const art = useSampleArtwork();

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-canvas">
        {art.background && (
          <img
            src={art.background}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/10 to-transparent" />
        <div className="absolute start-2 top-2 origin-top-left scale-[0.62]">
          <ContentAdvisoryToast preview categories={SAMPLE} playKey="advisory-preview" />
        </div>
      </div>
      <span className="text-[11.5px] font-medium text-ink-subtle">{t("Live preview")}</span>
    </div>
  );
}
