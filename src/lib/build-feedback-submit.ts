import { safeFetch } from "@/lib/safe-fetch";
import { APP_VERSION, BUILD_ID, IS_BETA_BUILD } from "@/lib/build-info";
import { HARBOR_BUGS_BASE } from "@/lib/config/endpoints";

const URL = `${HARBOR_BUGS_BASE}/v1/feedback`;

export async function submitBuildFeedback(rating: number): Promise<boolean> {
  try {
    const res = await safeFetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: APP_VERSION, build: BUILD_ID, rating, beta: IS_BETA_BUILD }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
