import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { listComments, postComment, type ThemeComment } from "@/lib/theme-store";
import { deleteThemeCommentAcknowledged } from "@/lib/theme-comment-actions";
import { captureMembershipProfile, isMembershipProfileCurrent } from "@/lib/membership-operations";
import { authToken } from "@/lib/theme-auth";

export function useComments(themeId: string) {
  const [comments, setComments] = useState<ThemeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentTheme = useRef(themeId);
  currentTheme.current = themeId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listComments(themeId)
      .then((c) => !cancelled && setComments(c))
      .catch(
        (e) =>
          !cancelled && setError(e instanceof Error ? e.message : t("Could not load comments.")),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [themeId]);

  const add = useCallback(
    async (body: string, parentId?: string) => {
      const c = await postComment(themeId, body, parentId);
      setComments((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
    },
    [themeId],
  );

  const remove = useCallback(
    async (id: string) => {
      const profile = captureMembershipProfile();
      const token = authToken();
      if (!profile || !token || currentTheme.current !== themeId)
        throw new Error(t("The account or theme changed. Reopen the comment menu."));
      await deleteThemeCommentAcknowledged({ themeId, commentId: id, profile, token });
      if (
        currentTheme.current === themeId &&
        isMembershipProfileCurrent(profile) &&
        authToken() === token
      )
        setComments((cur) => cur.filter((c) => c.id !== id));
    },
    [themeId],
  );

  return { comments, loading, error, add, remove };
}
