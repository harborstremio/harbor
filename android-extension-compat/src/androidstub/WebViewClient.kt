package android.webkit

import android.graphics.Bitmap

/** Extensions subclass this and call up through super from every override, so each member here
 * needs a real body. An abstract member would link and then fail the first time a page loaded. */
open class WebViewClient {

    open fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {}

    open fun onPageFinished(view: WebView?, url: String?) {}

    open fun onLoadResource(view: WebView?, url: String?) {}

    open fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false

    open fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean = false

    open fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? = null

    open fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? = null

    open fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {}

    open fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {}

    companion object {
        const val ERROR_UNKNOWN = -1
        const val ERROR_HOST_LOOKUP = -2
        const val ERROR_CONNECT = -6
        const val ERROR_TIMEOUT = -8
        const val ERROR_FILE_NOT_FOUND = -14
    }
}
