package android.webkit

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import java.util.concurrent.Future

open class WebView(context: Context?) : View(context) {

    private val webSettings = WebSettings()
    private val bridges = LinkedHashMap<String, Any>()
    private val visited = ArrayList<String>()

    private var pageClient: WebViewClient? = null
    private var chromeClient: WebChromeClient? = null
    private var touchListener: View.OnTouchListener? = null
    private var inFlight: Future<*>? = null
    private var currentUrl: String? = null
    private var currentTitle: String? = null
    private var destroyed = false
    private var scrolledX = 0
    private var scrolledY = 0
    private var horizontalScrollBars = true
    private var verticalScrollBars = true

    init {
        width = DEFAULT_WIDTH
        height = DEFAULT_HEIGHT
    }

    open fun getSettings(): WebSettings = webSettings

    open fun setWebViewClient(client: WebViewClient?) {
        pageClient = client
    }

    open fun getWebViewClient(): WebViewClient? = pageClient

    open fun setWebChromeClient(client: WebChromeClient?) {
        chromeClient = client
    }

    open fun getWebChromeClient(): WebChromeClient? = chromeClient

    open fun loadUrl(url: String?) {
        start(url, null)
    }

    open fun loadUrl(url: String?, additionalHttpHeaders: MutableMap<String, String>?) {
        start(url, additionalHttpHeaders)
    }

    open fun loadDataWithBaseURL(
        baseUrl: String?,
        data: String?,
        mimeType: String?,
        encoding: String?,
        historyUrl: String?,
    ) {
        if (destroyed) return
        val shown = historyUrl ?: baseUrl ?: "about:blank"
        inFlight?.cancel(true)
        inFlight = null
        val client = pageClient
        val chrome = chromeClient
        noteLoadStarted(shown)
        WebEngine.schedule(
            Runnable {
                if (destroyed) return@Runnable
                guarded { client?.onPageStarted(this, shown, null) }
                noteLoadFinished(shown, null)
                guarded { chrome?.onProgressChanged(this, 100) }
                guarded { client?.onPageFinished(this, shown) }
            },
            0L,
        )
    }

    private fun start(url: String?, headers: Map<String, String>?) {
        val target = url?.trim().orEmpty()
        if (destroyed || target.isEmpty()) return
        inFlight?.cancel(true)
        inFlight = WebEngine.load(this, target, headers)
    }

    open fun stopLoading() {
        inFlight?.cancel(true)
        inFlight = null
    }

    open fun reload() {
        currentUrl?.let { loadUrl(it) }
    }

    open fun destroy() {
        destroyed = true
        inFlight?.cancel(true)
        inFlight = null
        pageClient = null
        chromeClient = null
        touchListener = null
        bridges.clear()
        visited.clear()
    }

    open fun onResume() {}

    open fun onPause() {}

    open fun canGoBack(): Boolean = visited.size > 1

    open fun goBack() {
        if (visited.size < 2) return
        visited.removeAt(visited.size - 1)
        val previous = visited.removeAt(visited.size - 1)
        loadUrl(previous)
    }

    open fun clearHistory() {
        val here = visited.lastOrNull()
        visited.clear()
        if (here != null) visited.add(here)
    }

    open fun clearCache(includeDiskFiles: Boolean) {}

    open fun removeAllViews() {}

    open fun setHorizontalScrollBarEnabled(enabled: Boolean) {
        horizontalScrollBars = enabled
    }

    open fun setVerticalScrollBarEnabled(enabled: Boolean) {
        verticalScrollBars = enabled
    }

    open fun setOnTouchListener(listener: View.OnTouchListener?) {
        touchListener = listener
    }

    open fun getHandler(): Handler = sharedHandler

    open fun getTitle(): String? = currentTitle

    open fun getUrl(): String? = currentUrl

    open fun getOriginalUrl(): String? = currentUrl

    open fun evaluateJavascript(script: String?, resultCallback: ValueCallback<String>?) {
        if (resultCallback == null) return
        WebEngine.schedule(Runnable { guarded { resultCallback.onReceiveValue("null") } }, 0L)
    }

    open fun addJavascriptInterface(obj: Any?, interfaceName: String?) {
        if (obj == null || interfaceName.isNullOrEmpty()) return
        bridges[interfaceName] = obj
    }

    open fun removeJavascriptInterface(interfaceName: String?) {
        if (interfaceName == null) return
        bridges.remove(interfaceName)
    }

    open fun javascriptInterfaces(): Map<String, Any> = LinkedHashMap(bridges)

    open fun postDelayed(action: Runnable?, delayMillis: Long): Boolean {
        if (action == null || destroyed) return false
        return WebEngine.schedule(Runnable { guarded { action.run() } }, delayMillis)
    }

    open fun dispatchTouchEvent(event: MotionEvent?): Boolean {
        val listener = touchListener ?: return false
        return try {
            listener.onTouch(this, event)
        } catch (t: Throwable) {
            false
        }
    }

    open fun scrollBy(x: Int, y: Int) {
        scrolledX = maxOf(0, scrolledX + x)
        scrolledY = maxOf(0, scrolledY + y)
    }

    open fun scrollTo(x: Int, y: Int) {
        scrolledX = maxOf(0, x)
        scrolledY = maxOf(0, y)
    }

    open fun getScrollX(): Int = scrolledX

    open fun getScrollY(): Int = scrolledY

    internal fun pageClientOrNull(): WebViewClient? = pageClient

    internal fun chromeClientOrNull(): WebChromeClient? = chromeClient

    internal fun isDestroyed(): Boolean = destroyed

    internal fun noteLoadStarted(url: String) {
        currentUrl = url
        currentTitle = null
        if (visited.lastOrNull() != url) visited.add(url)
        while (visited.size > MAX_HISTORY) visited.removeAt(0)
    }

    internal fun noteLoadFinished(url: String, title: String?) {
        currentUrl = url
        currentTitle = title
    }

    private fun guarded(block: () -> Unit) {
        try {
            block()
        } catch (t: Throwable) {
        }
    }

    companion object {
        private const val DEFAULT_WIDTH = 1280
        private const val DEFAULT_HEIGHT = 720
        private const val MAX_HISTORY = 32

        private val sharedHandler = Handler(Looper.getMainLooper())

        @JvmStatic
        fun setWebContentsDebuggingEnabled(enabled: Boolean) {}
    }
}
