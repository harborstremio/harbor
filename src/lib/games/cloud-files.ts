export type CloudProvider = "rd" | "tb" | "pm";
export type CloudKeys = Partial<Record<CloudProvider | "ad", string>>;
export type CloudEntry = { id: string; name: string; kind: "torrent" | "folder" | "file"; bytes: number | null; ready: boolean; status: "ready" | "preparing" | "failed" };
export type CloudPage = { entries: CloudEntry[]; next: number | null; label: string };
export type CloudDownload = { url: string; name: string; expectedBytes: number | null };
export const CLOUD_PROVIDERS: { id: CloudProvider; name: string }[] = [{ id: "rd", name: "Real-Debrid" }, { id: "tb", name: "TorBox" }, { id: "pm", name: "Premiumize" }];
export const cloudError = (reason: unknown) => { const value = reason instanceof Error ? reason.message : String(reason); return /^cloud_[a-z_]+$/.test(value) ? `games.cloud.${value}` : "games.cloud.cloud_network"; };
