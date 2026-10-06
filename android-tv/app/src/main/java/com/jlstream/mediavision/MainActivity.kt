package com.jlstream.mediavision

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/**
 * The JL Media Vision web app in a full-screen WebView for Android TV and the NVIDIA Shield.
 * The remote's D-pad drives the app's own TV focus navigation; Back walks back through the app
 * and asks before leaving.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    private val appHost: String get() = Uri.parse(BuildConfig.APP_URL).host ?: ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

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
        return super.dispatchKeyEvent(event)
    }

    /** Back: leave video full screen, then go back in the app, then ask before closing. */
    private fun onBack() {
        if (fullscreenView != null) { exitFullscreen(); return }
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

    override fun onStop() {
        super.onStop()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        // Where the web app lives now and after the domain swap.
        val APP_HOSTS = setOf("jl-media-vision.vercel.app", "watch.jl-stream.com")
    }
}
