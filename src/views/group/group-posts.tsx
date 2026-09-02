import { useCallback, useEffect, useState } from "react";
import { Loader2, MessagesSquare } from "lucide-react";
import { useT } from "@/lib/i18n";
import { fetchGroupPosts, type GroupPost } from "@/lib/social/group-posts";
import type { GroupDetail } from "@/lib/social/groups";
import { PostCompose } from "./post-compose";
import { PostItem } from "./post-item";

export function GroupPosts({
  detail,
  meAvatar,
  meAlias,
  onOpenProfile,
}: {
  detail: GroupDetail;
  meAvatar?: string;
  meAlias?: string;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [canPost, setCanPost] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setPhase("loading");
    fetchGroupPosts(detail.id, undefined, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setPosts(d.posts);
        setCursor(d.nextCursor);
        setCanPost(d.canPost);
        setPhase("ready");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setPhase("error");
      });
    return () => ctrl.abort();
  }, [detail.id, detail.isMember]);

  const loadMore = useCallback(() => {
    if (!cursor || more) return;
    setMore(true);
    fetchGroupPosts(detail.id, cursor)
      .then((d) => {
        setPosts((p) => [...p, ...d.posts]);
        setCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setMore(false));
  }, [cursor, more, detail.id]);

  const sort = (list: GroupPost[]) =>
    [...list].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <div className="flex flex-col gap-3">
      {canPost && (
        <PostCompose
          groupId={detail.id}
          groupName={detail.name}
          meAvatar={meAvatar}
          meAlias={meAlias}
          onPosted={(p) => setPosts((cur) => sort([p, ...cur]))}
        />
      )}

      {phase === "loading" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="harbor-shimmer relative h-[104px] rounded-lg ring-1 ring-edge-soft"
              style={{ ["--ai-delay" as string]: `${i * 110}ms` }}
            />
          ))}
        </div>
      ) : phase === "error" ? (
        <EmptyBox
          title={t("Posts are not available yet")}
          body={t("This group's feed could not be loaded. Try again in a moment.")}
        />
      ) : posts.length === 0 ? (
        <EmptyBox
          title={canPost ? t("Start the conversation") : t("Nothing posted yet")}
          body={
            canPost
              ? t("Share what you're watching, drop a recommendation, or announce a watch night.")
              : t("Join this group to post and see what everyone is watching.")
          }
        />
      ) : (
        <>
          {posts.map((p, i) => (
            <PostItem
              key={p.id}
              post={p}
              index={i}
              groupId={detail.id}
              onChanged={(next) => setPosts((cur) => sort(cur.map((x) => (x.id === next.id ? next : x))))}
              onRemoved={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))}
              onOpenProfile={onOpenProfile}
            />
          ))}
          {cursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={more}
              className="mx-auto mt-2 flex h-9 items-center gap-2 rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50"
            >
              {more && <Loader2 size={14} className="animate-spin" />} {t("Load more")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-edge bg-surface/30 px-6 py-14 text-center">
      <MessagesSquare size={30} strokeWidth={1.7} className="text-ink-subtle" />
      <div className="flex max-w-sm flex-col gap-1">
        <span className="text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="text-[13px] leading-relaxed text-ink-subtle">{body}</span>
      </div>
    </div>
  );
}
