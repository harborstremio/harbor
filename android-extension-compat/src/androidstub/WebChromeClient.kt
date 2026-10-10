package android.webkit

open class WebChromeClient {

    open fun onProgressChanged(view: WebView?, newProgress: Int) {}

    open fun onReceivedTitle(view: WebView?, title: String?) {}
}
