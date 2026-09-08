import { Check, Folder, ListPlus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { createListWithItem, type ListItemInput } from "@/lib/custom-lists";
import { captureMembershipProfile } from "@/lib/membership-operations";
import { buildMembershipActionSource, membershipFailureMessage } from "@/lib/membership-actions";
import type { MembershipContext } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { emitListToast } from "@/components/lists/list-toast";
import { CreateListModal } from "@/components/lists/create-list-modal";
import { ActionItems } from "./action-items";

export function MyListSubmenu({
  item,
  onClose,
  membership,
  membershipOnly = false,
  children,
}: {
  item: ListItemInput;
  onClose: () => void;
  membership?: MembershipContext;
  membershipOnly?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const [profile] = useState(captureMembershipProfile);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const creatingRef = useRef(false);
  const createdRef = useRef(false);
  const createTrigger = useRef<HTMLElement | null>(null);
  // Both visual groups share one refresh subscription and one command source.
  const [subscribe] = useState(() => {
    const listeners = new Set<() => void>();
    let timer: number | undefined;
    return (listener: () => void) => {
      listeners.add(listener);
      timer ??= window.setInterval(() => listeners.forEach((refresh) => refresh()), 300);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.clearInterval(timer);
          timer = undefined;
        }
      };
    };
  });
  const source = buildMembershipActionSource({
    item,
    profile,
    membership,
    membershipOnly,
    t,
    icon: (checked, kind) =>
      checked ? (
        <Check size={14} />
      ) : kind === "collection" ? (
        <Folder size={14} />
      ) : (
        <ListPlus size={14} />
      ),
    onResult: (result, name) => {
      const message =
        result.status === "moved"
          ? 'Moved to "{name}"'
          : result.status === "removed"
            ? 'Removed from "{name}"'
            : result.status === "already-present" || result.status === "unchanged"
              ? 'Already in "{name}"'
              : 'Added to "{name}"';
      emitListToast(t(message, { name }));
    },
    onCreateList: () => {
      createTrigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      creatingRef.current = true;
      createdRef.current = false;
      setCreateError("");
      setCreating(true);
    },
  });
  return (
    <>
      <ActionItems
        source={{
          ...source,
          subscribe,
          actions: () => source.actions().filter((action) => action.group !== "remove"),
        }}
        onClose={() => {
          if (!creatingRef.current) onClose();
        }}
      />
      {children}
      {membership && (
        <>
          <div role="separator" className="my-1 h-px bg-edge-soft/60" />
          <ActionItems
            source={{
              ...source,
              subscribe,
              actions: () => source.actions().filter((action) => action.group === "remove"),
            }}
            onClose={onClose}
          />
        </>
      )}
      {creating && (
        <CreateListModal
          contextLayer
          error={createError}
          create={(name) => {
            if (!profile) {
              setCreateError(t("The active profile changed. Open the menu again."));
              return null;
            }
            const created = createListWithItem(name, item, profile);
            if (!created.id) {
              setCreateError(t(membershipFailureMessage(created.result)));
              return null;
            }
            createdRef.current = true;
            return created.id;
          }}
          onCreated={() => emitListToast(t("Added to new list"))}
          onClose={() => {
            creatingRef.current = false;
            setCreating(false);
            if (createdRef.current) onClose();
            else requestAnimationFrame(() => createTrigger.current?.focus({ preventScroll: true }));
          }}
        />
      )}
    </>
  );
}
