package com.jlstream.mediavision

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

/**
 * The JL Media Vision web app in a full-screen WebView for Android TV and the NVIDIA Shield.
 * The remote's D-pad drives the app's own TV focus navigation; Back walks back through the app
 * and asks before leaving. Streams play in a native ExoPlayer ([NativePlayer]) the page drives
 * through `window.JLNativePlayer` (see android-tv/README.md).
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private lateinit var nativePlayer: NativePlayer
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    private val appHost: String get() = Uri.parse(BuildConfig.APP_URL).host ?: ""

    /** Whether the WebView is on an app page; the bridge reads it off the main thread. */
    @Volatile private var onAppPage = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        nativePlayer = NativePlayer(this, root, web, ::dispatchPlayerEvent)

        CookieManager.getInstance().setAcceptCookie(true)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // Many IPTV providers still serve plain-http streams.
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = "$userAgentString JLMediaVisionTV/${BuildConfig.VERSION_NAME}"
        }
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.addJavascriptInterface(PlayerBridge(), "JLNativePlayer")
        web.webViewClient = object : WebViewClient() {
            // The app stays in this view; any other site opens in the plain in-app browser.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == appHost || uri.host in APP_HOSTS) return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    startActivity(Intent(this@MainActivity, BrowserActivity::class.java).setData(uri))
                }
                return true
            }

            // A new document can't drive the player the old one started.
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                onAppPage = isAppUrl(url)
                nativePlayer.stop("navigation")
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                onAppPage = isAppUrl(url)
            }

            override fun onScaleChanged(view: WebView, oldScale: Float, newScale: Float) {
                nativePlayer.cssScale = newScale
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            // Video full screen from the web player.
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return }
                fullscreenView = view
                fullscreenCallback = callback
                root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                web.visibility = View.GONE
            }

            override fun onHideCustomView() = exitFullscreen()
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl(BuildConfig.APP_URL)
    }

    private fun isAppUrl(url: String?): Boolean {
        val host = Uri.parse(url ?: return false).host ?: return false
        return host == appHost || host in APP_HOSTS
    }

    private fun dispatchPlayerEvent(detail: JSONObject) {
        if (!isAppUrl(web.url)) return
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('jl-native-player', {detail: $detail}))", null)
    }

    private fun exitFullscreen() {
        val view = fullscreenView ?: return
        root.removeView(view)
        fullscreenView = null
        web.visibility = View.VISIBLE
        fullscreenCallback?.onCustomViewHidden()
        fullscreenCallback = null
        web.requestFocus()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val back = event.keyCode == KeyEvent.KEYCODE_BACK || event.keyCode == KeyEvent.KEYCODE_ESCAPE
        if (back) {
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) onBack()
            return true
        }
        if (nativePlayer.handleFullKey(event)) return true
        return super.dispatchKeyEvent(event)
    }

    /** Back: leave video full screen, then go back in the app, then ask before closing. */
    private fun onBack() {
        if (fullscreenView != null) { exitFullscreen(); return }
        if (nativePlayer.isActive && nativePlayer.mode == NativePlayer.Mode.FULL) { nativePlayer.exitFull(); return }
        if (web.canGoBack()) { web.goBack(); return }
        AlertDialog.Builder(this)
            .setTitle("Leave JL Media Vision?")
            .setPositiveButton("Leave") { _, _ -> finish() }
            .setNegativeButton("Stay", null)
            .show()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        nativePlayer.pause()
    }

    override fun onStop() {
        super.onStop()
        // Frees the decoder and the provider connection (IPTV accounts often allow only one).
        nativePlayer.stop("background")
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        nativePlayer.release()
        web.destroy()
        super.onDestroy()
    }

    /**
     * `window.JLNativePlayer`. Calls arrive on a WebView thread; player work hops to the main
     * thread, and is dropped unless the WebView is still on an app page.
     */
    private inner class PlayerBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = onAppPage

        /** False when the URL isn't http(s) or the page isn't the app. */
        @JavascriptInterface
        fun play(url: String?, headersJson: String?, title: String?, startMs: Long): Boolean {
            if (!onAppPage || url == null) return false
            val uri = Uri.parse(url)
            if ((uri.scheme != "https" && uri.scheme != "http") || uri.host.isNullOrEmpty()) return false
            val headers = parseHeaders(headersJson)
            onMain { nativePlayer.play(url, headers, title.orEmpty(), startMs) }
            return true
        }

        @JavascriptInterface
        fun setRect(x: Double, y: Double, w: Double, h: Double) = onMain { nativePlayer.setRect(x, y, w, h) }

        @JavascriptInterface
        fun setMode(mode: String?) {
            val next = when (mode) {
                "full" -> NativePlayer.Mode.FULL
                "hero" -> NativePlayer.Mode.HERO
                "hidden" -> NativePlayer.Mode.HIDDEN
                else -> return
            }
            onMain { nativePlayer.setMode(next) }
        }

        @JavascriptInterface
        fun pause() = onMain { nativePlayer.pause() }

        @JavascriptInterface
        fun resume() = onMain { nativePlayer.resume() }

        @JavascriptInterface
        fun seek(ms: Long) = onMain { nativePlayer.seek(ms) }

        @JavascriptInterface
        fun stop() = onMain { nativePlayer.stop() }

        private fun onMain(action: () -> Unit) {
            if (!onAppPage) return
            runOnUiThread { if (isAppUrl(web.url)) action() }
        }

        private fun parseHeaders(json: String?): Map<String, String> {
            val o = try { JSONObject(json ?: return emptyMap()) } catch (_: Exception) { return emptyMap() }
            val headers = HashMap<String, String>()
            for (name in o.keys()) {
                val value = o.optString(name)
                if (name.isNotBlank() && value.isNotEmpty()) headers[name] = value
            }
            return headers
        }
    }

    companion object {
        // Where the web app lives now and after the domain swap.
        val APP_HOSTS = setOf("jl-media-vision.vercel.app", "watch.jl-stream.com")
    }
}
