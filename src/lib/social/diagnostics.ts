import { authToken } from "@/lib/theme-auth";
import { socialGet } from "./client";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

export type DiagnosticsStaff = { handle: string; name: string; role: string };

export type DiagnosticsRequestSummary = {
  id: string;
  ticket: string;
  staff: DiagnosticsStaff;
  note: string | null;
  status: "pending" | "submitted" | "expired";
  requestedAt: number;
};

export function fetchDiagnosticsRequest(
  id: string,
  signal?: AbortSignal,
): Promise<DiagnosticsRequestSummary> {
  return socialGet<DiagnosticsRequestSummary>(
    `/social/me/diagnostics/${encodeURIComponent(id)}`,
    signal,
  );
}

export async function uploadDiagnosticsBundle(
  id: string,
  bytes: Uint8Array,
): Promise<{ ok: boolean; ticket: string }> {
  const token = authToken();
  const form = new FormData();
  form.append("bundle", new Blob([bytes], { type: "application/zip" }), `${id}.zip`);
  const r = await fetch(`${API}/social/me/diagnostics/${encodeURIComponent(id)}/bundle`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const message = typeof d.error === "string" ? d.error : `Upload failed (${r.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return d as { ok: boolean; ticket: string };
}
