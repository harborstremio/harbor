import { authToken } from "@/lib/theme-auth";
import { deleteComment, listComments } from "@/lib/theme-store";
import { isMembershipProfileCurrent, type MembershipProfile } from "@/lib/membership-operations";

export async function deleteThemeCommentAcknowledged(request: {
  themeId: string;
  commentId: string;
  profile: MembershipProfile;
  token: string;
}): Promise<void> {
  const { themeId, commentId, profile, token } = request;
  const validate = () => {
    if (!token || !isMembershipProfileCurrent(profile) || authToken() !== token)
      throw new Error("The active profile or account changed. Reopen the comment menu.");
  };
  validate();
  const fresh = await listComments(themeId);
  validate();
  const comment = fresh.find((entry) => entry.id === commentId && entry.themeId === themeId);
  if (!comment) throw new Error("This comment is no longer available.");
  if (comment.canDelete !== true)
    throw new Error("You no longer have permission to delete this comment.");
  await deleteComment(themeId, commentId);
}
