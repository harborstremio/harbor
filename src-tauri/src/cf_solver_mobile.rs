// Android stand-in for cf_solver, bound as `crate::cf_solver` by a #[path]
// mod declaration in lib.rs so http_fetch compiles unmodified.
//
// The real solver drives a hidden webview window through a Cloudflare
// interstitial. Android has one webview and no second window, so the capability
// is genuinely absent rather than merely unported. These are real bodies, not
// placeholders: the cache is always empty and cf_fetch reports the failure so
// harbor_fetch surfaces the original Cloudflare response instead of silently
// returning a challenge page as if it were content.

use tauri::AppHandle;

pub fn cf_cached(_host: &str) -> Option<(String, String)> {
    None
}

pub fn cf_invalidate(_host: &str) {}

pub async fn cf_fetch(_app: AppHandle, url: String) -> Result<String, String> {
    Err(format!(
        "cloudflare challenge for {} cannot be solved on Android: the solver needs a second webview window",
        url
    ))
}
