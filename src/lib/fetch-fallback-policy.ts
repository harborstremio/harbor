const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "x-harbor-auth",
  "x-harbor-subtitle-credential",
  "cookie",
]);

const HARBOR_POLICY_ERROR =
  /blocked internal target|too many redirects|redirect(?: url| bad scheme| from https| cannot| cross-origin)|cross-origin redirect|response size limit exceeded|subtitle credential/i;

export function hasSensitiveRequestHeaders(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  try {
    let found = false;
    new Headers(headers).forEach((_value, name) => {
      if (SENSITIVE_HEADERS.has(name.toLowerCase())) found = true;
    });
    return found;
  } catch {
    if (Array.isArray(headers)) {
      return headers.some(([name]) => SENSITIVE_HEADERS.has(String(name).toLowerCase()));
    }
    if (typeof headers === "object") {
      return Object.keys(headers).some((name) => SENSITIVE_HEADERS.has(name.toLowerCase()));
    }
    return true;
  }
}

export function isHarborFetchPolicyError(error: unknown): boolean {
  let message: string;
  if (error instanceof Error) message = `${error.name}: ${error.message}`;
  else if (typeof error === "string") message = error;
  else {
    try {
      message = JSON.stringify(error) ?? "";
    } catch {
      message = String(error);
    }
  }
  return HARBOR_POLICY_ERROR.test(message);
}

export function shouldFallbackToPluginHttp(error: unknown, init?: RequestInit): boolean {
  return !hasSensitiveRequestHeaders(init?.headers) && !isHarborFetchPolicyError(error);
}
