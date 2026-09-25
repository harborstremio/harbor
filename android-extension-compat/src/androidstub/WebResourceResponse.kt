package android.webkit

import java.io.InputStream

open class WebResourceResponse {
    private var mime: String? = null
    private var charset: String? = null
    private var stream: InputStream? = null
    private var code: Int = 200
    private var reason: String? = "OK"
    private var headers: MutableMap<String, String> = LinkedHashMap()

    constructor(mimeType: String?, encoding: String?, data: InputStream?) {
        mime = mimeType
        charset = encoding
        stream = data
    }

    constructor(
        mimeType: String?,
        encoding: String?,
        statusCode: Int,
        reasonPhrase: String?,
        responseHeaders: MutableMap<String, String>?,
        data: InputStream?
    ) {
        mime = mimeType
        charset = encoding
        code = statusCode
        reason = reasonPhrase
        if (responseHeaders != null) headers = responseHeaders
        stream = data
    }

    open fun getMimeType(): String? = mime
    open fun setMimeType(mimeType: String?) { mime = mimeType }
    open fun getEncoding(): String? = charset
    open fun setEncoding(encoding: String?) { charset = encoding }
    open fun getData(): InputStream? = stream
    open fun setData(data: InputStream?) { stream = data }
    open fun getStatusCode(): Int = code
    open fun getReasonPhrase(): String? = reason
    open fun getResponseHeaders(): MutableMap<String, String>? = headers
    open fun setResponseHeaders(responseHeaders: MutableMap<String, String>?) {
        headers = responseHeaders ?: LinkedHashMap()
    }

    open fun setStatusCodeAndReasonPhrase(statusCode: Int, reasonPhrase: String?) {
        code = statusCode
        reason = reasonPhrase
    }
}
