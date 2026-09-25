package android.webkit

import android.content.Context
import android.view.MotionEvent
import android.view.View
import java.util.concurrent.Future

/** A view that retrieves pages without drawing or scripting them.
 *
 * What works: settings state, loading an address, the page and progress callbacks, the title of the
 * document that came back, the cookies the server set, and delayed posts. What cannot work here is
 * anything that needs a rendered page or a script engine, which includes the clearance flows that
 * wait for script on the page to produce a token. Those loads complete, report the challenge title
 * they were served, and let their caller time out on its own schedule. The limitation is reported,
 * never disguised as success, and nothing on this class throws. */
open class WebView(context: Context?) : View(context) {

    private val webSettings = WebSettings()
    private val bridges = LinkedHashMap<String, Any>()

    private var pageClient: WebViewClient? = null
    private var chromeClient: WebChromeClient? = null
    private var inFlight: Future<*>? = null
    private var currentUrl: String? = null
    private var currentTitle: String? = null
    private var destroyed = false
    private var scrolledX = 0
    private var scrolledY = 0

    init {
        // Extensions position an on screen cursor against these, so zero would collapse every
        // coordinate they compute onto the same point.
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
        bridges.clear()
    }

    open fun getTitle(): String? = currentTitle

    open fun getUrl(): String? = currentUrl

    open fun getOriginalUrl(): String? = currentUrl

    /** There is no script engine behind this view, so the only honest answer is the one the
     * platform itself gives for a script whose result is undefined. The callback is still
     * delivered, so a caller waiting on it is released rather than left hanging. */
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

    /** The objects the page was told it could call into, kept so a host that later supplies a
     * script engine can bind them. */
    open fun javascriptInterfaces(): Map<String, Any> = LinkedHashMap(bridges)

    open fun postDelayed(action: Runnable?, delayMillis: Long): Boolean {
        if (action == null || destroyed) return false
        return WebEngine.schedule(Runnable { guarded { action.run() } }, delayMillis)
    }

    open fun dispatchTouchEvent(event: MotionEvent?): Boolean = false

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

        @JvmStatic
        fun setWebContentsDebuggingEnabled(enabled: Boolean) {}
    }
}
