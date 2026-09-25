import type { ContextAction } from "../context-actions";

type FileScope = { id: string; path: string; title: string; kind?: string; format?: string };
type Translate = (key: string, values?: Record<string, string | number>) => string;
const plain: Translate = (key, values) =>
  key.replace(/\{(\w+)\}/g, (match, name: string) => String(values?.[name] ?? match));

/** Progress is deliberately excluded: confirmation concerns exact files and
 * membership, while the store rechecks writer/playback safety at execution. */
export function downloadConfirmation(
  items: FileScope[],
  action: "delete" | "cancel",
  scope: string,
  actor: string,
  t: Translate = plain,
): NonNullable<ContextAction["confirmation"]> {
  const receiptOnly = items.every((item) => item.kind === "ebook" && item.format === "pdf");
  const count = items.length;
  const details = items.length === 1 ? `${scope}\n${items[0].path}` : scope;
  const filename = items[0]?.path.split(/[\\/]/).pop() || items[0]?.title || scope;
  const description =
    action === "cancel"
      ? t("Cancel {count} downloads? Partial files are kept.\n\n{scope}", { count, scope })
      : receiptOnly
        ? t(
            "Remove {count} PDF print records from Downloads? Harbor did not save these PDF files.",
            { count },
          )
        : t(
            "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}",
            { count, details },
          );
  return {
    key: JSON.stringify([
      actor,
      action,
      scope,
      items
        .map(({ id, path, kind, format }) => [id, path, kind, format])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ]),
    title:
      action === "cancel"
        ? t("Cancel download")
        : receiptOnly
          ? t("Remove from downloads")
          : count === 1
            ? t("Delete file")
            : t("Delete files ({count})", { count }),
    description,
    summary:
      action === "cancel"
        ? t("{count} downloads. Partial files are kept.", { count })
        : receiptOnly
          ? t("{count} print records; no saved PDF files.", { count })
          : count === 1
            ? filename
            : t("{count} files · {scope}", { count, scope }),
    confirmLabel:
      action === "cancel"
        ? t("Confirm cancellation")
        : receiptOnly
          ? t("Remove")
          : count === 1
            ? t("Delete file")
            : t("Delete files ({count})", { count }),
    pendingLabel: action === "cancel" ? t("Cancelling…") : t("Removing…"),
    successLabel: action === "cancel" ? t("Cancelled") : t("Removed"),
  };
}
