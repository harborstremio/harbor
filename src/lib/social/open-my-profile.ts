import { fetchMe } from "@/lib/account/identity";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { currentAuthor } from "@/lib/theme-auth";
import { captureSocialActor, assertSocialActor } from "./action-actor";

export async function openMyProfile(fallbackHandle?: string | null): Promise<boolean> {
  const actor = captureSocialActor();
  let handle = (currentAuthor()?.handle || fallbackHandle || "").trim();
  if (!handle) {
    await fetchMe().catch(() => {});
    assertSocialActor(actor);
    handle = (currentAuthor()?.handle || "").trim();
  }
  if (!handle) return false;
  assertSocialActor(actor);
  requestOpenProfile(handle);
  return true;
}
