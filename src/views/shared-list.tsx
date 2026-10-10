import { currentAuthor } from "@/lib/theme-auth";
import { useView } from "@/lib/view";
import { SharedListBackdrop } from "./shared-list/shared-list-backdrop";
import { SharedListHero } from "./shared-list/shared-list-hero";
import { SharedListPosters } from "./shared-list/shared-list-posters";
import { SharedListLoading, SharedListMissing } from "./shared-list/shared-list-states";
import { useSharedList } from "./shared-list/use-shared-list";

export function SharedListView({
  handle,
  listId,
  onOpenProfile,
  onOpenMeta,
}: {
  handle: string;
  listId: string;
  onOpenProfile?: (handle: string) => void;
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const { goBack } = useView();
  const { state, summary, list, reload } = useSharedList(handle, listId);
  const signedIn = !!currentAuthor();

  return (
    <div className="relative h-full overflow-y-auto bg-canvas">
      <SharedListBackdrop banner={summary?.bannerUrl} />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 pb-24 pt-[15vh]">
        {state === "loading" && <SharedListLoading />}
        {state === "error" && <SharedListMissing kind="error" onBack={goBack} onRetry={reload} />}
        {state === "missing" && <SharedListMissing kind="missing" onBack={goBack} />}
        {state === "ready" && summary && list && (
          <>
            <SharedListHero summary={summary} list={list} signedIn={signedIn} onOpenProfile={onOpenProfile} />
            <div className="w-full">
              <SharedListPosters items={list.items} onOpenMeta={onOpenMeta} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
