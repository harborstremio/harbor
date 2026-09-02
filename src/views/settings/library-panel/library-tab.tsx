import animeCatIcon from "@/assets/category/anime.svg";
import livetvCatIcon from "@/assets/category/livetv.svg";
import adultCatIcon from "@/assets/category/adult.svg";
import { BookOpen, Download, HardDrive } from "lucide-react";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { useT } from "@/lib/i18n";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Section, ToggleRow } from "../shared";
import { SettingGroup, SettingRow } from "../kit";

export function LibraryTab() {
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
  const t = useT();
  const posterSizes: DropdownOption[] = [
    { value: "w342", label: t("342px (small)") },
    { value: "w500", label: t("500px (recommended)") },
    { value: "w780", label: t("780px (large)") },
    { value: "original", label: t("Original") },
  ];
  const backdropSizes: DropdownOption[] = [
    { value: "w780", label: t("780px (small)") },
    { value: "w1280", label: t("1280px (recommended)") },
    { value: "original", label: t("Original") },
  ];
  const logoSizes: DropdownOption[] = [
    { value: "w300", label: t("300px (small)") },
    { value: "w500", label: t("500px (recommended)") },
    { value: "original", label: t("Original") },
  ];

  const pushHideContent = (
    key: "anime" | "sports" | "liveTv" | "adult" | "manga",
    value: boolean,
  ) => {
    const next = { ...settings.hideContent, [key]: value };
    update({ hideContent: next });
    if (activeProfile) updateProfile(activeProfile.id, { hideContent: next });
  };

  return (
    <>
      <Section
        title={t("Content filters")}
        subtitle={t(
          "Hide entire categories. Toggling these also removes the matching sidebar entries and rails.",
        )}
      >
        <ToggleRow
          label={t("Hide anime")}
          leading={<CatIcon src={animeCatIcon} />}
          sub={t(
            "Removes the Anime tab and every anime title from all rows everywhere: Home, Discover, Top 10, and catalogs. Western animation like Pixar is kept, and you can still find anime by searching.",
          )}
          value={settings.hideContent.anime}
          onChange={(v) => pushHideContent("anime", v)}
        />
        <ToggleRow
          label={t("Hide manga")}
          leading={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink">
              <BookOpen size={28} strokeWidth={2} />
            </span>
          }
          sub={t("Removes the Manga tab from the sidebar.")}
          value={settings.hideContent.manga}
          onChange={(v) => pushHideContent("manga", v)}
        />
        <ToggleRow
          label={t("Hide Live TV")}
          leading={<CatIcon src={livetvCatIcon} />}
          sub={t("Removes the Live TV tab from the sidebar.")}
          value={settings.hideContent.liveTv}
          onChange={(v) => pushHideContent("liveTv", v)}
        />
        <ToggleRow
          label={t("Hide adult content")}
          leading={<CatIcon src={adultCatIcon} />}
          sub={t("Filters out streams from adult catalogs and addons. On by default.")}
          value={settings.hideContent.adult}
          onChange={(v) => pushHideContent("adult", v)}
        />
      </Section>

      <Section
        title={t("Local library")}
        subtitle={t(
          "Options for the Library → Local tab: folders you scan from your own drive. When you export metadata, Harbor writes a Kodi-style .nfo and downloads artwork next to each file at the sizes below.",
        )}
      >
        <SettingGroup label={t("On disk")}>
          <SettingRow
            icon={<HardDrive size={16} />}
            label={t("Minimum file size")}
            desc={t("Files smaller than this are skipped when scanning a folder.")}
            tip={t(
              "Files smaller than this are skipped when scanning a folder, so clips and samples stay out. Set to 0 to include everything.",
            )}
          >
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                min={0}
                value={settings.localMinFileSizeMb}
                onChange={(e) =>
                  update({
                    localMinFileSizeMb: Math.max(0, Math.round(Number(e.target.value) || 0)),
                  })
                }
                className="h-10 w-20 rounded-md bg-canvas px-3 text-[13.5px] text-ink outline-none"
              />
              <span className="text-[13px] text-ink-muted">{t("MB")}</span>
            </div>
          </SettingRow>
        </SettingGroup>

        <SettingGroup label={t("Metadata export")}>
          <SettingRow
            wide
            icon={<Download size={16} />}
            label={t("Export artwork")}
            desc={t(
              "The resolution Harbor downloads for each image when you export a title's metadata next to the file on disk.",
            )}
          >
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              <ArtworkField
                label={t("Poster")}
                ratio="portrait"
                value={settings.nfoPosterSize}
                options={posterSizes}
                onChange={(v) => update({ nfoPosterSize: v })}
              />
              <ArtworkField
                label={t("Backdrop")}
                ratio="landscape"
                value={settings.nfoBackdropSize}
                options={backdropSizes}
                onChange={(v) => update({ nfoBackdropSize: v })}
              />
              <ArtworkField
                label={t("Logo")}
                ratio="logo"
                value={settings.nfoLogoSize}
                options={logoSizes}
                onChange={(v) => update({ nfoLogoSize: v })}
              />
            </div>
          </SettingRow>
        </SettingGroup>
      </Section>
    </>
  );
}

function ArtworkSwatch({ ratio }: { ratio: "portrait" | "landscape" | "logo" }) {
  const t = useT();
  const art = useSampleArtwork();
  if (ratio === "logo") {
    return (
      <div className="flex h-11 w-full items-center justify-center rounded-md bg-canvas px-3">
        {art.logo ? (
          <img
            src={art.logo}
            alt=""
            draggable={false}
            className="max-h-6 max-w-full object-contain"
          />
        ) : (
          <span className="font-display text-[13px] italic tracking-tight text-ink/50">
            {t("Logo")}
          </span>
        )}
      </div>
    );
  }
  const src = ratio === "portrait" ? art.poster : art.background;
  const box = ratio === "portrait" ? "aspect-[2/3] w-[30px]" : "aspect-video w-[68px]";
  return (
    <div className="flex h-11 w-full items-center justify-center rounded-md bg-canvas">
      <div className={`overflow-hidden rounded-[3px] bg-elevated ${box}`}>
        {src && <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />}
      </div>
    </div>
  );
}

function ArtworkField({
  label,
  ratio,
  value,
  options,
  onChange,
}: {
  label: string;
  ratio: "portrait" | "landscape" | "logo";
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ArtworkSwatch ratio={ratio} />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <Dropdown value={value} options={options} onChange={onChange} />
    </div>
  );
}

function CatIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-10 w-10 shrink-0 select-none object-contain"
    />
  );
}
