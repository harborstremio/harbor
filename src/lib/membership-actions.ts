import {
  MAX_COLLECTION_ITEMS,
  readPersistedCollectionSnapshot,
  removeCollectionMembership,
  setCollectionMembership,
  subscribeCollections,
  type Collection,
} from "./collections";
import {
  MAX_ITEMS,
  MAX_LISTS,
  sharedLists,
  type ListItemInput,
  type ListStore,
} from "./custom-lists";
import {
  readLocalWatchlistMembership,
  setLocalWatchlistMembership,
  subscribeLocalWatchlist,
} from "./local-watchlist";
import {
  isMembershipProfileCurrent,
  isMembershipItemInput,
  type MembershipProfile,
  type MembershipResult,
} from "./membership-operations";
import type { ActionSource, ContextAction } from "./context-actions";
import type { MembershipContext } from "./context-menu";

type Translate = (key: string, values?: Record<string, string | number>) => string;
const SEARCH_DESTINATION_THRESHOLD = 8;
export type MembershipDestination = Pick<Collection, "id" | "coverImage" | "bgImage">;
type Destination = MembershipDestination & {
  name: string;
  items: Array<{ id: string }>;
  updatedAt: number;
  order?: number;
};
type Options = {
  item: ListItemInput;
  profile: MembershipProfile | null;
  membership?: MembershipContext;
  membershipOnly?: boolean;
  store?: ListStore;
  t?: Translate;
  icon?: (
    checked: boolean,
    kind: "list" | "collection",
    destination?: MembershipDestination,
  ) => ContextAction["icon"];
  commandIcon?: (command: "add" | "create" | "remove") => ContextAction["icon"];
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
  const { profile, membership } = options;
  const listStore = options.store ?? membership?.store ?? sharedLists;
  const item = { ...options.item };
  const t: Translate =
    options.t ??
    ((key, values) => key.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? name)));
  const isValid = () => isMembershipItemInput(item) && isMembershipProfileCurrent(profile);
  const report = (result: MembershipResult, name: string) => {
    if (result.status === "error") throw new Error(t(membershipFailureMessage(result)));
    options.onResult?.(result, name);
  };
  const order = new Map<string, number>();
  const known: Record<"list" | "collection", Destination[]> = { list: [], collection: [] };
  const destinations = (
    kind: "list" | "collection",
    containers: Array<{
      id: string;
      name: string;
      items: Array<{ id: string }>;
      [key: string]: unknown;
    }>,
  ): Destination[] =>
    containers
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        items: entry.items,
        coverImage: typeof entry.coverImage === "string" ? entry.coverImage : undefined,
        bgImage: typeof entry.bgImage === "string" ? entry.bgImage : undefined,
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
        order: typeof entry.order === "number" ? entry.order : undefined,
      }))
      .sort((a, b) => {
        const order =
          kind === "list"
            ? (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
            : 0;
        return order || b.updatedAt - a.updatedAt;
      });
  const stableOrder = <T extends { id: string }>(kind: string, containers: T[]): T[] => {
    for (const container of containers) {
      const id = `${kind}:${container.id}`;
      if (!order.has(id)) order.set(id, order.size);
    }
    return [...containers].sort(
      (a, b) => order.get(`${kind}:${a.id}`)! - order.get(`${kind}:${b.id}`)!,
    );
  };
  return {
    isValid,
    subscribe: (listener) => {
      const stop = [
        subscribeCollections(listener),
        listStore.subscribeLists(listener),
        subscribeLocalWatchlist(listener),
      ];
      const onStorage = (event: StorageEvent) => {
        if (
          !event.key ||
          event.key.startsWith(listStore.storageKey) ||
          /^(harbor\.(collections|customlists|localwatchlist)\.|harbor\.profiles\.v1$)/.test(
            event.key,
          )
        )
          listener();
      };
      if (typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
        window.addEventListener("harbor:profiles-updated", listener);
      }
      return () => {
        stop.forEach((unsubscribe) => unsubscribe());
        if (typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
          window.removeEventListener("harbor:profiles-updated", listener);
        }
      };
    },
    actions: () => {
      const available = isValid();
      const noProfile = { status: "error", reason: "profile-changed" } as const;
      const listSnapshot = profile ? listStore.readPersistedListSnapshot(profile) : noProfile;
      const collectionSnapshot = profile ? readPersistedCollectionSnapshot(profile) : noProfile;
      const listFailure = "status" in listSnapshot ? listSnapshot : undefined;
      const collectionFailure = "status" in collectionSnapshot ? collectionSnapshot : undefined;
      if (!("status" in listSnapshot)) known.list = destinations("list", listSnapshot.containers);
      if (!("status" in collectionSnapshot))
        known.collection = destinations("collection", collectionSnapshot.containers);
      const lists = stableOrder("list", known.list);
      const collections = stableOrder("collection", known.collection);
      const addDestinations = (kind: "list" | "collection"): ContextAction[] => {
        if (options.membershipOnly && kind !== membership?.kind) return [];
        const containers = kind === "list" ? lists : collections;
        const failure = kind === "list" ? listFailure : collectionFailure;
        if (failure && !containers.length)
          return [
            {
              id: `membership:unavailable:${kind}`,
              label: t(kind === "list" ? "Lists unavailable" : "Collections unavailable"),
              group: kind,
              sectionLabel: t(kind === "list" ? "Lists" : "Collections"),
              disabled: true,
              reason: t(membershipFailureMessage(failure)),
            },
          ];
        const maximum = kind === "list" ? MAX_ITEMS : MAX_COLLECTION_ITEMS;
        return containers.map((container) => {
          const checked = failure
            ? undefined
            : container.items.some((entry) => entry.id === item.id);
          const full = container.items.length >= maximum;
          return {
            id: `membership:add:${kind}:${container.id}`,
            label: container.name,
            icon: options.icon?.(checked === true, kind, container),
            checked,
            dismiss: "keep-open",
            group: kind,
            sectionLabel: t(kind === "list" ? "Lists" : "Collections"),
            disabled: !available || !!failure || (!checked && full),
            reason: failure
              ? t(membershipFailureMessage(failure))
              : !checked && full
                ? t("This destination is full.")
                : undefined,
            run: () => {
              if (!profile) throw new Error(t("The active profile changed. Open the menu again."));
              // Preserve this activation's intended state. The service reads a
              // fresh snapshot and commits synchronously; a stale Add never
              // turns into Remove when another source already added the title.
              report(
                kind === "list"
                  ? listStore.setListMembership(container.id, item, !checked, profile)
                  : setCollectionMembership(container.id, item, !checked, profile),
                container.name,
              );
            },
          };
        });
      };
      const defaultState = profile ? readLocalWatchlistMembership(profile, item.id) : noProfile;
      const defaultChecked = defaultState.status === "ready" ? defaultState.present : undefined;
      const actions: ContextAction[] = [
        {
          id: "membership:add",
          label: t("Add to"),
          icon: options.commandIcon?.("add"),
          group: "membership",
          disabled: !available,
          searchable: lists.length + collections.length + 1 > SEARCH_DESTINATION_THRESHOLD,
          searchPlaceholder: t("Search destinations"),
          children: [
            ...(!options.membershipOnly && listStore === sharedLists
              ? [
                  {
                    id: "membership:add:default",
                    label: t("My List"),
                    group: "list",
                    sectionLabel: t("Lists"),
                    icon: options.icon?.(defaultChecked === true, "list"),
                    checked: defaultChecked,
                    dismiss: "keep-open" as const,
                    disabled: !available || defaultState.status === "error",
                    reason:
                      defaultState.status === "error"
                        ? t(membershipFailureMessage(defaultState))
                        : undefined,
                    run: () => {
                      if (profile)
                        report(
                          setLocalWatchlistMembership(profile, item, !defaultChecked),
                          t("My List"),
                        );
                    },
                  },
                ]
              : []),
            ...addDestinations("list"),
            ...(options.onCreateList && !options.membershipOnly
              ? [
                  {
                    id: "membership:create-list",
                    label: t("Create new list"),
                    icon: options.commandIcon?.("create"),
                    group: "create",
                    sectionLabel: t("Lists"),
                    disabled: !available || !!listFailure || lists.length >= MAX_LISTS,
                    reason: listFailure
                      ? t(membershipFailureMessage(listFailure))
                      : lists.length >= MAX_LISTS
                        ? t("You have reached {max} lists. Remove one to make room.", {
                            max: MAX_LISTS,
                          })
                        : undefined,
                    restoreFocus: false,
                    run: options.onCreateList,
                  },
                ]
              : []),
            ...addDestinations("collection"),
          ],
        },
      ];
      if (membership) {
        const containers = membership.kind === "list" ? lists : collections;
        const source = containers.find((container) => container.id === membership.id);
        const inSource = !!source?.items.some((entry) => entry.id === item.id);
        const failure = membership.kind === "list" ? listFailure : collectionFailure;
        actions.push({
          id: `membership:remove:${membership.kind}:${membership.id}`,
          label: t('Remove from "{name}"', { name: source?.name ?? t("source") }),
          icon: options.commandIcon?.("remove"),
          group: "remove",
          danger: true,
          disabled: !available || !!failure || !inSource,
          reason: failure ? t(membershipFailureMessage(failure)) : undefined,
          run: () => {
            if (!profile) throw new Error(t("The active profile changed. Open the menu again."));
            const request = { sourceId: membership.id, itemId: item.id, profile };
            report(
              membership.kind === "list"
                ? listStore.removeListMembership(request)
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
