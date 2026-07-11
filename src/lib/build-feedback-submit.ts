import { APP_VERSION, IS_BETA_BUILD } from "@/lib/build-info";
import { safeFetch } from "@/lib/safe-fetch";

const URL = "https://bugs.harbor.site/v1/feedback";

export async function submitBuildFeedback(rating: number): Promise<boolean> {
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
