import { fetchMe } from "@/lib/account/identity";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { currentAuthor } from "@/lib/theme-auth";

export async function openMyProfile(fallbackHandle?: string | null): Promise<boolean> {
  let handle = (currentAuthor()?.handle || fallbackHandle || "").trim();
  if (!handle) {
    await fetchMe().catch(() => {});
    handle = (currentAuthor()?.handle || "").trim();
  }
  if (!handle) return false;
  requestOpenProfile(handle);
  return true;
}
