package android.webkit

import android.net.Uri

interface WebResourceRequest {
    fun getUrl(): Uri?
    fun getMethod(): String?
    fun getRequestHeaders(): MutableMap<String, String>?
    fun isForMainFrame(): Boolean
    fun isRedirect(): Boolean
    fun hasGesture(): Boolean
}
