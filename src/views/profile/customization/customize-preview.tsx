import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { currentAuthor } from "@/lib/theme-auth";
import type { CustomizationInput, ProfileSummary } from "../profile-types";
import { AboutCard } from "../about-card";
import { ProfileHero } from "../profile-hero";
import { CanvasCard } from "./canvas-frame";
import { resolveCustomization, useFontLink } from "./apply";

export function CustomizePreview({
  summary,
  form,
}: {
  summary: ProfileSummary;
  form: CustomizationInput;
}) {
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const { settings } = useSettings();

  const preview: ProfileSummary = {
    ...summary,
    profileFont: form.profileFont,
    profileFavicon: form.profileFavicon,
    pageBgColor: form.pageBgColor,
    pageBgImage: form.pageBgImage,
    customHtml: form.customHtml,
    customCss: form.customCss,
    canvasHeight: form.canvasHeight,
    customEnabled: form.customEnabled,
    hideTopBanner: form.hideTopBanner,
  };
  const c = resolveCustomization(preview);
  useFontLink(c.fontHref);

  const ownerAvatar =
    activeProfile?.avatar || settings.harborAvatar || user?.avatar || currentAuthor()?.avatar || undefined;
  const heroAvatar = ownerAvatar || summary.avatarUrl;
  const heroAvatarFallback = summary.avatarUrl || undefined;

  return (
    <div className="min-h-full" style={c.background ? { background: c.background } : undefined}>
      <ProfileHero
        p={preview}
        avatar={heroAvatar}
        avatarFallback={heroAvatarFallback}
        badges={[]}
        userFont={c.font}
        hideBanner={c.hideTopBanner}
      />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-28 lg:px-10">
        <AboutCard description={preview.description} isOwner userFont={c.font} />
        {c.hasCanvas && (
          <CanvasCard html={c.html} css={c.css} height={c.height} hiddenFromVisitors={c.hiddenFromVisitors} />
        )}
      </div>
    </div>
  );
}
