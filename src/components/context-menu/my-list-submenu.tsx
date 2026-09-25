import { ListPlus, ListX, Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { sharedLists, type ListStore, type ListItemInput } from "@/lib/custom-lists";
import { captureMembershipProfile } from "@/lib/membership-operations";
import { buildMembershipActionSource, membershipFailureMessage } from "@/lib/membership-actions";
import type { MembershipContext } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { emitListToast } from "@/components/lists/list-toast";
import { CreateListModal } from "@/components/lists/create-list-modal";
import { ActionItems, restoreMenuAction } from "./action-items";
import { UiIcon } from "@/components/ui-icon";
import { CollectionDestinationIcon } from "./collection-destination-icon";

export function MyListSubmenu({
  item,
  onClose,
  membership,
  membershipOnly = false,
  children,
  store = membership?.store ?? sharedLists,
}: {
  item: ListItemInput;
  onClose: () => void;
  membership?: MembershipContext;
  membershipOnly?: boolean;
  children?: ReactNode;
  store?: ListStore;
}) {
  const t = useT();
  const [profile] = useState(captureMembershipProfile);
  const [selectedItem] = useState(() => ({ ...item }));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const creatingRef = useRef(false);
  const createdRef = useRef<string | null>(null);
  const createRoot = useRef<HTMLElement | null>(null);
  // MenuSurface keys this subtree by its semantic session. Keep destination
  // order and the selected item stable through saves and harmless rerenders.
  const [source] = useState(() =>
    buildMembershipActionSource({
      item: selectedItem,
      store,
      profile,
      membership,
      membershipOnly,
      t,
      icon: (_checked, kind, destination) =>
        kind === "collection" ? (
          <CollectionDestinationIcon destination={destination} />
        ) : (
          <ListPlus size={14} />
        ),
      commandIcon: (command) => {
        if (command === "add") return <UiIcon name="add-to" className="size-4" />;
        const Icon = { create: Plus, remove: ListX }[command];
        return <Icon size={16} />;
      },
      onResult: (result, name) => {
        if (result.status === "unchanged") return;
        const message =
          result.status === "removed"
            ? 'Removed from "{name}"'
            : result.status === "already-present"
              ? 'Already in "{name}"'
              : 'Added to "{name}"';
        emitListToast(t(message, { name }));
      },
      onCreateList: () => {
        createRoot.current = document.querySelector<HTMLElement>(
          "[data-harbor-menu-panel]:not([data-context-submenu])",
        );
        creatingRef.current = true;
        createdRef.current = null;
        setCreateError("");
        setCreating(true);
      },
    }),
  );
  return (
    <>
      <ActionItems
        source={{
          ...source,
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
              actions: () => source.actions().filter((action) => action.group === "remove"),
            }}
            onClose={onClose}
          />
        </>
      )}
      {creating && (
        <CreateListModal
          store={store}
          contextLayer
          error={createError}
          create={(name, description) => {
            if (!profile) {
              setCreateError(t("The active profile changed. Open the menu again."));
              return null;
            }
            const created = store.createListWithItem(name, selectedItem, profile, description);
            if (!created.id) {
              setCreateError(t(membershipFailureMessage(created.result)));
              return null;
            }
            createdRef.current = created.id;
            return created.id;
          }}
          onCreated={() => emitListToast(t("Added to new list"))}
          onClose={() => {
            creatingRef.current = false;
            setCreating(false);
            const root = createRoot.current;
            const destination = createdRef.current
              ? `membership:add:list:${createdRef.current}`
              : "membership:create-list";
            requestAnimationFrame(() => {
              if (root?.isConnected) restoreMenuAction("membership:add", destination);
            });
          }}
        />
      )}
    </>
  );
}
