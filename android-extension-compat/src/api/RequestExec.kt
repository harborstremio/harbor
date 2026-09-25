package com.lagradost.nicehttp

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.CacheControl
import okhttp3.Callback
import okhttp3.FormBody
import okhttp3.Headers
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val MAX_TEXT_BYTES = 32L * 1024 * 1024

internal fun buildUrl(url: String, params: Map<String, String>): HttpUrl {
    val parsed = url.trim().toHttpUrl()
    if (params.isEmpty()) return parsed
    val builder = parsed.newBuilder()
    params.forEach { (k, v) -> builder.addQueryParameter(k, v) }
    return builder.build()
}

internal fun buildHeaders(
    defaults: Map<String, String>,
    headers: Map<String, String>,
    referer: String?,
    defaultReferer: String?,
    cookies: Map<String, String>,
    defaultCookies: Map<String, String>
): Headers {
    val merged = LinkedHashMap<String, String>()
    defaults.forEach { (k, v) -> merged[k.lowercase()] = v }
    headers.forEach { (k, v) -> merged[k.lowercase()] = v }

    val ref = referer ?: defaultReferer
    if (ref != null && !merged.containsKey("referer")) merged["referer"] = ref

    val allCookies = defaultCookies + cookies
    if (allCookies.isNotEmpty()) {
        val existing = merged["cookie"]
        val jar = allCookies.entries.joinToString("; ") { "${it.key}=${it.value}" }
        merged["cookie"] = if (existing.isNullOrBlank()) jar else "$existing; $jar"
    }

    val builder = Headers.Builder()
    merged.forEach { (k, v) -> builder.add(k, v) }
    return builder.build()
}

internal fun buildBody(
    data: Map<String, String>?,
    files: List<NiceFile>?,
    json: Any?,
    requestBody: RequestBody?,
    parser: ResponseParser?
): RequestBody? {
    if (requestBody != null) return requestBody

    if (json != null) {
        val text = when (json) {
            is String -> json
            else -> (parser ?: JsonResponseParser()).writeValueAsString(json)
        }
        return text.toRequestBody(RequestBodyTypes.JSON.toMediaTypeOrNull())
    }

    if (!files.isNullOrEmpty()) {
        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
        data?.forEach { (k, v) -> builder.addFormDataPart(k, v) }
        files.forEach { part ->
            val type = part.contentType?.toMediaTypeOrNull()
            val body = part.file?.asRequestBody(type)
                ?: part.fileBytes?.toRequestBody(type)
                ?: return@forEach
            builder.addFormDataPart(part.name, part.fileName, body)
        }
        return builder.build()
    }

    if (!data.isNullOrEmpty()) {
        val builder = FormBody.Builder()
        data.forEach { (k, v) -> builder.add(k, v) }
        return builder.build()
    }

    return null
}

internal fun clientFor(
    base: OkHttpClient,
    allowRedirects: Boolean,
    timeout: Long,
    interceptor: Interceptor?,
    verify: Boolean
): OkHttpClient {
    val root = if (verify) base else unsafeClient(base)
    if (interceptor == null && timeout <= 0 && allowRedirects == root.followRedirects) return root
    return root.newBuilder()
        .followRedirects(allowRedirects)
        .followSslRedirects(allowRedirects)
        .apply {
            if (timeout > 0) {
                connectTimeout(timeout, TimeUnit.SECONDS)
                readTimeout(timeout, TimeUnit.SECONDS)
                writeTimeout(timeout, TimeUnit.SECONDS)
            }
            if (interceptor != null) addInterceptor(interceptor)
        }
        .build()
}

internal fun cacheControl(cacheTime: Int, cacheUnit: TimeUnit): CacheControl? {
    if (cacheTime <= 0) return null
    return CacheControl.Builder().maxAge(cacheTime, cacheUnit).build()
}

internal suspend fun Call.awaitResponse(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            cont.resume(response)
        }

        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(e)
        }
    })
    cont.invokeOnCancellation { try { cancel() } catch (t: Throwable) { } }
}

internal fun readText(response: Response, wantsBody: Boolean): String? {
    if (!wantsBody) return null
    val body = response.body ?: return ""
    if (body.contentLength() > MAX_TEXT_BYTES) {
        try { body.close() } catch (t: Throwable) { }
        return ""
    }
    return try {
        body.string()
    } catch (t: Throwable) {
        ""
    }
}

internal fun requestOf(
    method: String,
    url: HttpUrl,
    headers: Headers,
    body: RequestBody?,
    cache: CacheControl?
): Request {
    val builder = Request.Builder().url(url).headers(headers).method(method, body)
    if (cache != null) builder.cacheControl(cache)
    return builder.build()
}

private var unsafePair: Pair<OkHttpClient, OkHttpClient>? = null

@Synchronized
private fun unsafeClient(base: OkHttpClient): OkHttpClient {
    unsafePair?.let { if (it.first === base) return it.second }
    val trust = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }
    val context = SSLContext.getInstance("TLS")
    context.init(null, arrayOf(trust), SecureRandom())
    val built = base.newBuilder()
        .sslSocketFactory(context.socketFactory, trust)
        .hostnameVerifier { _, _ -> true }
        .build()
    unsafePair = base to built
    return built
}

internal val EMPTY_BODY: RequestBody = ByteArray(0).toRequestBody(null)
