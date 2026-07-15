import { safeFetch } from "@/lib/safe-fetch";
import { APP_VERSION, IS_BETA_BUILD } from "@/lib/build-info";

const URL = (import.meta.env.VITE_FEEDBACK_ENDPOINT as string | undefined) || "";

export async function submitBuildFeedback(rating: number): Promise<boolean> {
  if (!URL) return false;
  try {
    const res = await safeFetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: APP_VERSION, rating, beta: IS_BETA_BUILD }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
