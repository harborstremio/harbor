package com.lagradost.nicehttp

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import java.util.concurrent.TimeUnit

class Requests(
    var baseClient: OkHttpClient = OkHttpClient.Builder()
        .followRedirects(true)
        .followSslRedirects(true)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build(),
    var defaultHeaders: Map<String, String> = DEFAULT_HEADERS,
    var defaultReferer: String? = null,
    var defaultData: Map<String, String> = emptyMap(),
    var defaultCookies: Map<String, String> = emptyMap(),
    var responseParser: ResponseParser? = JsonResponseParser(),
    var defaultCacheTime: Int = 0,
    var defaultCacheTimeUnit: TimeUnit = TimeUnit.MINUTES,
    var defaultTimeOut: Long = 30L
) {
    suspend fun get(
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        "GET", url, headers, referer, params, cookies, null, null, null, null,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    suspend fun head(
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        "HEAD", url, headers, referer, params, cookies, null, null, null, null,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    suspend fun post(
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        data: Map<String, String>? = null,
        files: List<NiceFile>? = null,
        json: Any? = null,
        requestBody: RequestBody? = null,
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        "POST", url, headers, referer, params, cookies, data, files, json, requestBody,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    suspend fun put(
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        data: Map<String, String>? = null,
        files: List<NiceFile>? = null,
        json: Any? = null,
        requestBody: RequestBody? = null,
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        "PUT", url, headers, referer, params, cookies, data, files, json, requestBody,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    suspend fun delete(
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        data: Map<String, String>? = null,
        files: List<NiceFile>? = null,
        json: Any? = null,
        requestBody: RequestBody? = null,
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        "DELETE", url, headers, referer, params, cookies, data, files, json, requestBody,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    suspend fun custom(
        method: String,
        url: String,
        headers: Map<String, String> = emptyMap(),
        referer: String? = null,
        params: Map<String, String> = emptyMap(),
        cookies: Map<String, String> = emptyMap(),
        data: Map<String, String>? = null,
        files: List<NiceFile>? = null,
        json: Any? = null,
        requestBody: RequestBody? = null,
        allowRedirects: Boolean = true,
        cacheTime: Int = defaultCacheTime,
        cacheUnit: TimeUnit = defaultCacheTimeUnit,
        timeout: Long = defaultTimeOut,
        interceptor: Interceptor? = null,
        verify: Boolean = true,
        responseParser: ResponseParser? = this.responseParser
    ): NiceResponse = send(
        method.uppercase(), url, headers, referer, params, cookies, data, files, json, requestBody,
        allowRedirects, cacheTime, cacheUnit, timeout, interceptor, verify, responseParser
    )

    private suspend fun send(
        method: String,
        url: String,
        headers: Map<String, String>,
        referer: String?,
        params: Map<String, String>,
        cookies: Map<String, String>,
        data: Map<String, String>?,
        files: List<NiceFile>?,
        json: Any?,
        requestBody: RequestBody?,
        allowRedirects: Boolean,
        cacheTime: Int,
        cacheUnit: TimeUnit,
        timeout: Long,
        interceptor: Interceptor?,
        verify: Boolean,
        responseParser: ResponseParser?
    ): NiceResponse {
        val parser = responseParser ?: this.responseParser
        val payload = if (method == "GET" || method == "HEAD") null else
            buildBody(data ?: defaultData.takeIf { it.isNotEmpty() }, files, json, requestBody, parser)
                ?: EMPTY_BODY

        val request = requestOf(
            method,
            buildUrl(url, params),
            buildHeaders(defaultHeaders, headers, referer, defaultReferer, cookies, defaultCookies),
            payload,
            cacheControl(cacheTime, cacheUnit)
        )

        val client = clientFor(baseClient, allowRedirects, timeout, interceptor, verify)
        val wantsBody = method != "HEAD"
        val first = send(client, request, wantsBody)
        val retry = ChallengeSolve.retryOf(request, first.first, first.second)
            ?: return NiceResponse(first.first, parser, first.second)
        first.first.close()
        val cleared = send(client, retry, wantsBody)
        return NiceResponse(cleared.first, parser, cleared.second)
    }

    private suspend fun send(
        client: OkHttpClient,
        request: Request,
        wantsBody: Boolean,
    ): Pair<Response, String?> {
        val started = System.nanoTime()
        try {
            val response = client.newCall(request).awaitResponse()
            val text = readText(response, wantsBody)
            val type = response.header("content-type").orEmpty().substringBefore(';').trim()
            noted(record(request.method, request.url.toString(), response.code, type, text?.length ?: 0, started, null))
            return response to text
        } catch (t: Throwable) {
            noted(record(request.method, request.url.toString(), 0, "", 0, started, describe(t)))
            throw t
        }
    }

    private fun noted(record: RequestRecord) {
        serviceLedger?.invoke(record)
        requestWatch?.invoke(record)
    }

    private fun record(
        method: String,
        url: String,
        status: Int,
        contentType: String,
        bytes: Int,
        startedNanos: Long,
        error: String?,
    ) = RequestRecord(
        method, url, status, contentType, bytes,
        (System.nanoTime() - startedNanos) / 1_000_000, error,
    )

    private fun describe(failure: Throwable): String {
        val message = failure.message?.lineSequence()?.firstOrNull()?.trim().orEmpty()
        return if (message.isEmpty()) failure::class.java.simpleName else "${failure::class.java.simpleName}: $message"
    }
}
