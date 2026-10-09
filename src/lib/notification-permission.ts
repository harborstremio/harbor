/** Match the permission authority to the backend which will deliver the notification. */
export async function automaticNotificationPermission(nativeDesktop: boolean, browserPermission: NotificationPermission | undefined, readNative: () => Promise<boolean | null>): Promise<boolean> {
  if (!nativeDesktop) return browserPermission === "granted";
  // A WebView's browser permission does not govern the native desktop notification API.
  try { return (await readNative()) === true; } catch { return false; }
}
