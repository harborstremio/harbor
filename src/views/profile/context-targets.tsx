import { Copy, Link2, UserRound } from "lucide-react";
import type { ContextMenuTarget } from "@/lib/context-menu";
import type { ContextAction } from "@/lib/context-actions";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { t } from "@/lib/i18n";
import { copyContextText } from "@/components/context-menu/content-actions";
import { currentAuthor } from "@/lib/theme-auth";
import { fetchSummary } from "./profile-api";
import { acceptFriend, removeFriend, sendFriendRequest } from "@/lib/social/friends";
import { friendCommand, type FriendStatus } from "@/lib/social/friend-command";
import { confirmDialog } from "@/lib/dialog";

const relationshipListeners = new Set<(handle: string, status: FriendStatus) => void>();
export function publishFriendStatus(handle: string, status: FriendStatus) {
  for (const listener of relationshipListeners) listener(handle, status);
}
export function subscribeFriendStatus(listener: (handle: string, status: FriendStatus) => void) {
  relationshipListeners.add(listener);
  return () => {
    relationshipListeners.delete(listener);
  };
}

export function friendContextActions(handle: string, status?: FriendStatus): ContextAction[] {
  const self = currentAuthor()?.handle;
  const command = friendCommand(status);
  if (!self || self.toLowerCase() === handle.toLowerCase() || !command) return [];
  const labels = {
    request: t("Add friend"),
    cancel: t("Cancel request"),
    accept: t("Accept request"),
    remove: t("Remove friend…"),
  };
  return [
    {
      id: `friend:${command}`,
      label: labels[command],
      group: "relationship",
      danger: command === "remove",
      run: async () => {
        const current = await fetchSummary(handle);
        if (currentAuthor()?.handle !== self) throw new Error(t("The active profile changed."));
        if (friendCommand(current.friendStatus) !== command) {
          if (current.friendStatus) publishFriendStatus(handle, current.friendStatus);
          throw new Error(t("The relationship changed. Open the menu again."));
        }
        if (
          command === "remove" &&
          !(await confirmDialog(t("Remove @{handle} from your friends?", { handle })))
        )
          return;
        if (currentAuthor()?.handle !== self) throw new Error(t("The active profile changed."));
        let next: FriendStatus;
        if (command === "request") {
          await sendFriendRequest(handle);
          next = "outgoing";
        } else if (command === "accept") {
          if (!current.friendEdgeId)
            throw new Error(t("The friend request is no longer available."));
          await acceptFriend(current.friendEdgeId);
          next = "friends";
        } else {
          await removeFriend(handle);
          next = "none";
        }
        if (currentAuthor()?.handle === self) publishFriendStatus(handle, next);
      },
    },
  ];
}

export function userContextTarget(
  handle: string,
  actions: ContextAction[] = [],
): ContextMenuTarget {
  const valid = /^[a-z\d_.-]+$/i.test(handle);
  return {
    kind: "actions",
    id: `user:${handle.toLowerCase()}`,
    label: `@${handle}`,
    actions: () => [
      {
        id: "user:open",
        label: t("Open profile"),
        icon: <UserRound size={14} />,
        disabled: !valid,
        run: () => requestOpenProfile(handle),
      },
      ...actions,
      {
        id: "user:copy-name",
        label: t("Copy username"),
        icon: <Copy size={14} />,
        group: "copy",
        run: () => copyContextText(handle),
      },
      ...(valid
        ? [
            {
              id: "user:copy-link",
              label: t("Copy profile link"),
              icon: <Link2 size={14} />,
              group: "copy",
              run: () => copyContextText(`${HARBOR_API_BASE}/u/${encodeURIComponent(handle)}`),
            },
          ]
        : []),
    ],
  };
}
