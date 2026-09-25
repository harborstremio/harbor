package android.webkit

/** Real state, not inert setters. Extensions read the user agent back out after editing it and use
 * it as the identity for their own HTTP requests, so a setter that dropped the value would make
 * every later request disagree with the one that collected the cookies. */
open class WebSettings {

    private var userAgent: String = DEFAULT_USER_AGENT
    private var javaScript: Boolean = false
    private var domStorage: Boolean = false
    private var allowContent: Boolean = true
    private var allowFile: Boolean = true
    private var loadImages: Boolean = true
    private var mixedContent: Int = MIXED_CONTENT_NEVER_ALLOW
    private var databases: Boolean = false
    private var cacheMode: Int = 0
    private var mediaPlaybackGesture: Boolean = true
    private var useWide: Boolean = false
    private var loadOverview: Boolean = false
    private var builtInZoom: Boolean = false
    private var displayZoom: Boolean = true
    private var zoomSupported: Boolean = true
    private var textZoomPercent: Int = 100

    open fun getUserAgentString(): String? = userAgent

    open fun setUserAgentString(ua: String?) {
        userAgent = if (ua.isNullOrEmpty()) DEFAULT_USER_AGENT else ua
    }

    open fun setJavaScriptEnabled(flag: Boolean) { javaScript = flag }
    open fun getJavaScriptEnabled(): Boolean = javaScript

    open fun setDomStorageEnabled(flag: Boolean) { domStorage = flag }
    open fun getDomStorageEnabled(): Boolean = domStorage

    open fun setAllowContentAccess(flag: Boolean) { allowContent = flag }
    open fun getAllowContentAccess(): Boolean = allowContent

    open fun setAllowFileAccess(flag: Boolean) { allowFile = flag }
    open fun getAllowFileAccess(): Boolean = allowFile

    open fun setLoadsImagesAutomatically(flag: Boolean) { loadImages = flag }
    open fun getLoadsImagesAutomatically(): Boolean = loadImages

    open fun setMixedContentMode(mode: Int) { mixedContent = mode }
    open fun getMixedContentMode(): Int = mixedContent

    open fun setDatabaseEnabled(flag: Boolean) { databases = flag }
    open fun getDatabaseEnabled(): Boolean = databases

    open fun setCacheMode(mode: Int) { cacheMode = mode }
    open fun getCacheMode(): Int = cacheMode

    open fun setMediaPlaybackRequiresUserGesture(require: Boolean) { mediaPlaybackGesture = require }
    open fun getMediaPlaybackRequiresUserGesture(): Boolean = mediaPlaybackGesture

    open fun setUseWideViewPort(use: Boolean) { useWide = use }
    open fun getUseWideViewPort(): Boolean = useWide

    open fun setLoadWithOverviewMode(overview: Boolean) { loadOverview = overview }
    open fun getLoadWithOverviewMode(): Boolean = loadOverview

    open fun setBuiltInZoomControls(enabled: Boolean) { builtInZoom = enabled }
    open fun getBuiltInZoomControls(): Boolean = builtInZoom

    open fun setDisplayZoomControls(enabled: Boolean) { displayZoom = enabled }
    open fun getDisplayZoomControls(): Boolean = displayZoom

    open fun setSupportZoom(support: Boolean) { zoomSupported = support }
    open fun supportZoom(): Boolean = zoomSupported

    open fun setTextZoom(percent: Int) { textZoomPercent = percent }
    open fun getTextZoom(): Int = textZoomPercent

    open fun setJavaScriptCanOpenWindowsAutomatically(flag: Boolean) {}
    open fun setSupportMultipleWindows(support: Boolean) {}
    open fun setGeolocationEnabled(flag: Boolean) {}

    companion object {
        const val MIXED_CONTENT_ALWAYS_ALLOW = 0
        const val MIXED_CONTENT_NEVER_ALLOW = 1
        const val MIXED_CONTENT_COMPATIBILITY_MODE = 2
        const val LOAD_DEFAULT = -1
        const val LOAD_CACHE_ELSE_NETWORK = 1
        const val LOAD_NO_CACHE = 2
        const val LOAD_CACHE_ONLY = 3

        /** Carries the marker that identifies an in-app browser, because extensions look for it and
         * strip it themselves when they want the request to read as a plain browser. */
        const val DEFAULT_USER_AGENT: String =
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36; wv"
    }
}
