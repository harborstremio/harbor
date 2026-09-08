import {
  addToCollection,
  MAX_COLLECTION_ITEMS,
  moveBetweenCollections,
  readCollections,
  removeCollectionMembership,
} from "./collections";
import {
  addToList,
  MAX_ITEMS,
  moveBetweenLists,
  readLists,
  removeListMembership,
  type ListItemInput,
} from "./custom-lists";
import { addLocalWatchlistItem, hasLocalWatchlistItem } from "./local-watchlist";
import {
  isMembershipProfileCurrent,
  type MembershipProfile,
  type MembershipResult,
} from "./membership-operations";
import type { ActionSource, ContextAction } from "./context-actions";
import type { MembershipContext } from "./context-menu";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Options = {
  item: ListItemInput;
  profile: MembershipProfile | null;
  membership?: MembershipContext;
  membershipOnly?: boolean;
  t?: Translate;
  icon?: (checked: boolean, kind: "list" | "collection") => ContextAction["icon"];
  onResult?: (result: MembershipResult, name: string) => void;
  onCreateList?: () => void;
};

export function membershipFailureMessage(result: MembershipResult): string {
  if (result.status !== "error") return "";
  switch (result.reason) {
    case "destination-full":
      return "This destination is full.";
    case "profile-changed":
      return "The active profile changed. Open the menu again.";
    case "missing-source":
      return "The source is no longer available.";
    case "missing-destination":
      return "The destination is no longer available.";
    case "missing-item":
      return "This item is no longer in the source.";
    case "invalid-data":
      return "The saved list data could not be read safely.";
    case "unsaved-changes":
      return "There are unsaved list changes. Free storage space and try again.";
    case "storage-failed":
      return "Could not save the change. Check available storage and try again.";
  }
}

export function buildMembershipActionSource(options: Options): ActionSource {
  const { item, profile, membership } = options;
  const t: Translate =
    options.t ??
    ((key, values) => key.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? name)));
  const isValid = () => isMembershipProfileCurrent(profile);
  const report = (result: MembershipResult, name: string) => {
    if (result.status === "error") throw new Error(t(membershipFailureMessage(result)));
    options.onResult?.(result, name);
  };
  return {
    isValid,
    actions: () => {
      const lists = readLists();
      const collections = readCollections();
      const available = isValid();
      const addDestinations = (kind: "list" | "collection"): ContextAction[] => {
        const containers = kind === "list" ? lists : collections;
        const maximum = kind === "list" ? MAX_ITEMS : MAX_COLLECTION_ITEMS;
        return containers.map((container) => {
          const checked = container.items.some((entry) => entry.id === item.id);
          const full = container.items.length >= maximum;
          return {
            id: `membership:add:${kind}:${container.id}`,
            label: container.name,
            icon: options.icon?.(checked, kind),
            group: kind,
            disabled: !available || checked || full,
            reason: checked
              ? t("Already added")
              : full
                ? t("This destination is full.")
                : undefined,
            run: () => {
              if (!profile) throw new Error(t("The active profile changed. Open the menu again."));
              report(
                kind === "list"
                  ? addToList(container.id, item, profile)
                  : addToCollection(container.id, item, profile),
                container.name,
              );
            },
          };
        });
      };
      const defaultChecked =
        !!profile && hasLocalWatchlistItem(profile.activeId ?? "default", item.id);
      const actions: ContextAction[] = options.membershipOnly
        ? []
        : [
            {
              id: "membership:add",
              label: t("Add to list or collection"),
              group: "membership",
              disabled: !available,
              children: [
                {
                  id: "membership:add:default",
                  label: t("My List"),
                  group: "default",
                  icon: options.icon?.(defaultChecked, "list"),
                  disabled: !available || defaultChecked,
                  reason: defaultChecked ? t("Already added") : undefined,
                  run: () => {
                    if (profile) report(addLocalWatchlistItem(profile, item), t("My List"));
                  },
                },
                ...addDestinations("list"),
                ...addDestinations("collection"),
              ],
            },
          ];
      if (options.onCreateList && !options.membershipOnly)
        actions.push({
          id: "membership:create-list",
          label: t("Create new list"),
          group: "membership",
          disabled: !available,
          run: options.onCreateList,
        });
      if (membership) {
        const containers = membership.kind === "list" ? lists : collections;
        const source = containers.find((container) => container.id === membership.id);
        const inSource = !!source?.items.some((entry) => entry.id === item.id);
        const maximum = membership.kind === "list" ? MAX_ITEMS : MAX_COLLECTION_ITEMS;
        actions.push({
          id: "membership:move",
          label: t("Move to"),
          group: "membership",
          disabled:
            !available ||
            !inSource ||
            containers.every((container) => container.id === membership.id),
          reason: containers.every((container) => container.id === membership.id)
            ? t("Create another destination first.")
            : undefined,
          children: containers
            .filter((container) => container.id !== membership.id)
            .map((destination) => ({
              id: `membership:move:${membership.kind}:${destination.id}`,
              label: destination.name,
              disabled:
                !available ||
                !inSource ||
                (destination.items.length >= maximum &&
                  !destination.items.some((entry) => entry.id === item.id)),
              run: () => {
                if (!profile)
                  throw new Error(t("The active profile changed. Open the menu again."));
                const request = {
                  sourceId: membership.id,
                  destinationId: destination.id,
                  itemId: item.id,
                  profile,
                };
                report(
                  membership.kind === "list"
                    ? moveBetweenLists(request)
                    : moveBetweenCollections(request),
                  destination.name,
                );
              },
            })),
        });
        actions.push({
          id: `membership:remove:${membership.kind}:${membership.id}`,
          label: t('Remove from "{name}"', { name: source?.name ?? t("source") }),
          group: "remove",
          danger: true,
          disabled: !available || !inSource,
          run: () => {
            if (!profile) throw new Error(t("The active profile changed. Open the menu again."));
            const request = { sourceId: membership.id, itemId: item.id, profile };
            report(
              membership.kind === "list"
                ? removeListMembership(request)
                : removeCollectionMembership(request),
              source?.name ?? "",
            );
          },
        });
      }
      return actions;
    },
  };
}
