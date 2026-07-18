type FailureSnapshot = {
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
};

export function mpvFailureSnapshot<T extends FailureSnapshot>(snapshot: T, reason: string): T {
  const errorMessage =
    reason === "persistent-event-errors"
      ? "The native player stopped responding."
      : "The native player stopped unexpectedly.";

  return {
    ...snapshot,
    status: "error",
    errorCode: "unknown",
    errorMessage,
  };
}
