import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { ProductionFacts } from "@/lib/providers/shotonwhat";

type Translate = (key: string) => string;

function ProductionSource({ url }: { url: string }) {
  const t = useT();
  return (
    <span className="flex items-center">
      <span className="me-1.5 text-ink-subtle">·</span>
      <button
        type="button"
        onClick={() => openUrl(url)}
        className="flex items-center gap-1 rounded-md text-[11.5px] font-medium text-ink-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        {t("ShotOnWhat")}
        <ExternalLink size={10} strokeWidth={2.2} />
      </button>
    </span>
  );
}

function medium(acquisition: string | null, t: Translate): string {
  if (!acquisition) return "";
  if (/celluloid/i.test(acquisition)) return t("Film");
  if (/^digital cinema$/i.test(acquisition)) return t("Digital");
  return acquisition;
}

function join(parts: Array<string | null>): string {
  return parts.filter((part): part is string => !!part && part.length > 0).join(" · ");
}

export function productionRows(
  facts: ProductionFacts,
  t: Translate,
): Array<{ label: string; node: ReactNode }> {
  const rows = [
    {
      label: t("Shot on"),
      value: join([medium(facts.acquisition, t), facts.negativeWidth, facts.aperture]),
    },
    {
      label: facts.cameras.length === 1 ? t("Camera") : t("Cameras"),
      value: join(facts.cameras),
    },
    {
      label: facts.lenses.length === 1 ? t("Lens") : t("Lenses"),
      value: join(facts.lenses),
    },
    { label: t("Film stock"), value: join(facts.filmStock) },
    { label: t("Finish"), value: join([facts.finish, facts.aspectRatio]) },
  ].filter((row) => row.value.length > 0);

  return rows.map((row, index) => ({
    label: row.label,
    node:
      index === 0 ? (
        <>
          <span>{row.value}</span>
          <ProductionSource url={facts.sourceUrl} />
        </>
      ) : (
        row.value
      ),
  }));
}
