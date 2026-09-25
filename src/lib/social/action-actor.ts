import { activeProfileId } from "@/lib/active-profile-id";
import { currentAuthor } from "@/lib/theme-auth";

export type SocialActionActor = { profileId: string; authorId: string | null };

export function captureSocialActor(): SocialActionActor {
  return { profileId: activeProfileId(), authorId: currentAuthor()?.id ?? null };
}

export function isSocialActorCurrent(actor: SocialActionActor): boolean {
  const current = captureSocialActor();
  return actor.profileId === current.profileId && actor.authorId === current.authorId;
}

export function assertSocialActor(actor: SocialActionActor): void {
  if (!isSocialActorCurrent(actor))
    throw new Error("The active profile changed. Open the menu again.");
}
