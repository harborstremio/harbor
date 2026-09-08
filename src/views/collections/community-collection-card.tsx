import { Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { posterPlate } from "@/components/poster";
import { getCollection, type Collection } from "@/lib/collections";
import { CommunityShareButton } from "./community-share-button";
import { CommunityShareModal } from "./community-share-modal";
import { AddToPageMenu } from "./add-to-page-menu";
import { useContextTarget } from "@/lib/context-menu";
import {
  captureMembershipProfile,
  isMembershipProfileCurrent,
  type MembershipProfile,
} from "@/lib/membership-operations";
import { authToken } from "@/lib/theme-auth";
import { CollectionMirrorUnavailableError } from "@/lib/collection-publication";

function coverFor(collection: Collection): string | undefined {
  return collection.coverImage || collection.items.find((it) => it.poster)?.poster;
}

export function CommunityCollectionCard({
  collection,
  onOpen,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (
    id: string,
    profile: MembershipProfile,
    token: string | null,
    localOnly?: boolean,
  ) => Promise<void>;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [deleteContext, setDeleteContext] = useState<{
    profile: MembershipProfile;
    token: string | null;
  } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [localOnlyAvailable, setLocalOnlyAvailable] = useState(false);
  const beginDelete = () => {
    const profile = captureMembershipProfile();
    setDeleteContext(profile ? { profile, token: authToken() } : null);
    setDeleteError("");
    setLocalOnlyAvailable(!authToken() && !collection.sourceHandle && !collection.sourceId);
    setConfirming(true);
  };
  const confirmDelete = async (localOnly = false) => {
    if (!deleteContext || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(collection.id, deleteContext.profile, deleteContext.token, localOnly);
      setConfirming(false);
    } catch (error) {
      if (error instanceof CollectionMirrorUnavailableError) setLocalOnlyAvailable(true);
      setDeleteError(error instanceof Error ? t(error.message) : t("Could not delete collection."));
    } finally {
      setDeleting(false);
    }
  };
  const [sharing, setSharing] = useState(false);
  const [pageMenu, setPageMenu] = useState(false);
  const coverRef = useRef<HTMLButtonElement>(null);
  const cover = coverFor(collection);
  const count = collection.items.length;
  const contextRef = useContextTarget<HTMLButtonElement>(() => {
    const profile = captureMembershipProfile();
    return {
      kind: "actions",
      id: `collection:${collection.id}`,
      label: collection.name,
      isValid: () => isMembershipProfileCurrent(profile) && !!getCollection(collection.id),
      actions: () => [
        {
          id: `collection:open:${collection.id}`,
          label: t("Open collection"),
          run: () => onOpen(collection.id),
          restoreFocus: false,
          group: "collection",
        },
        {
          id: `collection:edit:${collection.id}`,
          label: t("Edit collection"),
          run: () => onEdit(collection.id),
          restoreFocus: false,
          group: "collection",
        },
        {
          id: `collection:page:${collection.id}`,
          label: t("Add to a page"),
          run: () => setPageMenu(true),
          restoreFocus: false,
          group: "collection",
        },
        {
          id: `collection:share:${collection.id}`,
          label: t("Share"),
          run: () => setSharing(true),
          restoreFocus: false,
          group: "collection",
        },
        {
          id: `collection:delete:${collection.id}`,
          label: t("Delete collection"),
          run: beginDelete,
          restoreFocus: false,
          danger: true,
          group: "remove",
        },
      ],
    };
  });

  return (
    <div className="group/card relative">
      <button
        ref={(element) => {
          coverRef.current = element;
          contextRef(element);
        }}
        type="button"
        onClick={() => onOpen(collection.id)}
        className="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border border-edge-soft text-start shadow-[0_6px_22px_-14px_rgba(0,0,0,0.6)] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-edge"
        style={cover ? undefined : { background: posterPlate(collection.id + collection.name) }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        />
        <span className="absolute start-3.5 top-3 inline-flex items-center rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
          {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
        </span>
        <h3 className="absolute inset-x-4 bottom-3.5 line-clamp-2 font-display text-[20px] font-medium leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
          {collection.name}
        </h3>
      </button>

      <div className="absolute end-2.5 top-2.5 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(collection.id);
          }}
          title={t("Edit")}
          aria-label={t("Edit")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-canvas/85 text-ink-muted backdrop-blur-md transition-colors hover:border-edge hover:text-ink"
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
        <CommunityShareButton collectionId={collection.id} variant="icon" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            beginDelete();
          }}
          title={t("Delete")}
          aria-label={t("Delete")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-canvas/85 text-ink-muted backdrop-blur-md transition-colors hover:border-danger/50 hover:text-danger"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      <AddToPageMenu
        collectionId={collection.id}
        anchorRef={coverRef}
        open={pageMenu}
        onClose={() => setPageMenu(false)}
      />
      {sharing && (
        <CommunityShareModal collectionId={collection.id} onClose={() => setSharing(false)} />
      )}
      {confirming &&
        createPortal(
          <div
            className="fixed inset-0 z-[230] flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-md"
            onClick={() => !deleting && setConfirming(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !deleting) {
                event.preventDefault();
                event.stopPropagation();
                setConfirming(false);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={t("Delete this collection?")}
              className="flex w-[min(92vw,440px)] flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-[13.5px] font-medium text-ink">{t("Delete this collection?")}</p>
              <p className="text-xs text-ink-muted">
                {collection.sourceHandle || collection.sourceId
                  ? t("Only your saved copy is deleted. The original remains available.")
                  : localOnlyAvailable
                    ? t(
                        "Local-only deletion removes this collection from this device. Any copy in your Harbor account remains unchanged; its current status has not been verified.",
                      )
                    : t(
                        "Harbor will check your account and remove this collection there if it exists, then remove the local collection. Other account collections are preserved.",
                      )}
              </p>
              {deleteError && (
                <p role="alert" className="text-xs text-danger">
                  {deleteError}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  autoFocus
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="h-9 rounded-full border border-edge px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  {t("Cancel")}
                </button>
                {localOnlyAvailable && deleteContext?.token && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                    className="h-9 rounded-full border border-edge px-4 text-[13px] font-semibold text-ink-muted"
                  >
                    {t("Retry account check")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void confirmDelete(localOnlyAvailable)}
                  disabled={deleting || !deleteContext}
                  className="h-9 rounded-full bg-danger px-4 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  {deleting
                    ? t("Deleting…")
                    : localOnlyAvailable
                      ? t("Delete local copy only")
                      : t("Delete")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
