package android.webkit

import android.net.Uri

/** The request object handed to page clients when a load is about to move to a new address. */
internal class SimpleResourceRequest(
    private val target: String,
    private val redirect: Boolean = true
) : WebResourceRequest {

    override fun getUrl(): Uri? = Uri.parse(target)

    override fun getMethod(): String = "GET"

    override fun getRequestHeaders(): MutableMap<String, String> = LinkedHashMap()

    override fun isForMainFrame(): Boolean = true

    override fun isRedirect(): Boolean = redirect

    override fun hasGesture(): Boolean = false
}
