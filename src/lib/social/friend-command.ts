export type FriendStatus = "none" | "outgoing" | "incoming" | "friends" | "blocked";
export function friendCommand(
  status?: FriendStatus,
): "request" | "cancel" | "accept" | "remove" | null {
  switch (status) {
    case "none":
      return "request";
    case "outgoing":
      return "cancel";
    case "incoming":
      return "accept";
    case "friends":
      return "remove";
    default:
      return null;
  }
}
