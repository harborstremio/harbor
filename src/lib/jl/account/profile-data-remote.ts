import type { ProfileDocument, SyncValues } from "./document-sync.ts";
import { validateProfileData } from "./profile-data.ts";

const FIELD = "jl_harbor_v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Existing profiles_touch trigger + conditional PATCH prevents lost concurrent updates. */
export function createProfileDocumentRemote(
  rest: (path: string, init?: RequestInit) => Promise<Response>,
  profileId: string,
  owner: string,
) {
  let settings: Record<string, unknown> = {};
  let updatedAt = "";
  return {
    async pull(): Promise<ProfileDocument> {
      const res = await rest(
        `profiles?select=id,owner,name,settings,updated_at&id=eq.${encodeURIComponent(profileId)}`,
      );
      if (!res.ok) throw new Error(`JL profile sync failed (${res.status})`);
      const rows: unknown = await res.json();
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        !object(rows[0]) ||
        rows[0].id !== profileId ||
        rows[0].owner !== owner ||
        typeof rows[0].name !== "string" ||
        !rows[0].name.trim() ||
        rows[0].name.length > 40 ||
        !object(rows[0].settings) ||
        typeof rows[0].updated_at !== "string" ||
        !Number.isFinite(Date.parse(rows[0].updated_at))
      ) {
        throw new Error("Invalid JL profile response");
      }
      settings = rows[0].settings;
      updatedAt = rows[0].updated_at;
      const doc = settings[FIELD];
      if (doc === undefined) return { revision: 0, values: { "profile:name": rows[0].name } };
      if (!object(doc) || !Number.isSafeInteger(doc.revision) || (doc.revision as number) < 0)
        throw new Error("Invalid JL profile revision");
      return {
        revision: doc.revision as number,
        values: { ...validateProfileData(doc.values), "profile:name": rows[0].name },
      };
    },
    async compareAndSwap(expected: ProfileDocument, values: SyncValues): Promise<boolean> {
      validateProfileData(values);
      // Keep the exact server timestamp, including sub-millisecond precision. This
      // protects other consumers' settings too, while keeping the request URL short.
      const revisionFilter = settings[FIELD] === undefined ? "is.null" : `eq.${expected.revision}`;
      const filter = `id=eq.${encodeURIComponent(profileId)}&updated_at=eq.${encodeURIComponent(updatedAt)}&${encodeURIComponent(`settings->${FIELD}->>revision`)}=${revisionFilter}`;
      const res = await rest(`profiles?${filter}&select=id`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          ...(typeof values["profile:name"] === "string" ? { name: values["profile:name"] } : {}),
          settings: { ...settings, [FIELD]: { revision: expected.revision + 1, values } },
        }),
      });
      if (!res.ok) throw new Error(`JL profile sync failed (${res.status})`);
      const result: unknown = await res.json();
      if (
        !Array.isArray(result) ||
        result.length > 1 ||
        result.some((row) => !object(row) || row.id !== profileId)
      )
        throw new Error("Invalid JL profile update response");
      return result.length === 1;
    },
  };
}
