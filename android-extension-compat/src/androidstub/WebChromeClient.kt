package android.webkit

/** Same rule as the page client: every override in an extension calls up through super first. */
open class WebChromeClient {

    open fun onProgressChanged(view: WebView?, newProgress: Int) {}

    open fun onReceivedTitle(view: WebView?, title: String?) {}
}
