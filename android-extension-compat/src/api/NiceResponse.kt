package com.lagradost.nicehttp

import okhttp3.Headers
import okhttp3.Response
import okhttp3.ResponseBody
import org.jsoup.Jsoup
import org.jsoup.nodes.Document

class NiceResponse(
    val okhttpResponse: Response,
    val parser: ResponseParser? = null,
    private val readText: String? = null
) {
    val text: String by lazy {
        readText ?: try {
            okhttpResponse.body?.string() ?: ""
        } catch (t: Throwable) {
            ""
        }
    }

    val url: String get() = okhttpResponse.request.url.toString()

    val code: Int get() = okhttpResponse.code

    val isSuccessful: Boolean get() = okhttpResponse.isSuccessful

    val headers: Headers get() = okhttpResponse.headers

    val body: ResponseBody? get() = okhttpResponse.body

    val cookies: Map<String, String> by lazy {
        okhttpResponse.headers("set-cookie").mapNotNull { line ->
            val pair = line.substringBefore(';')
            val name = pair.substringBefore('=').trim()
            if (name.isEmpty() || !pair.contains('=')) null
            else name to pair.substringAfter('=').trim()
        }.toMap()
    }

    val document: Document by lazy { Jsoup.parse(text, url) }

    inline fun <reified T : Any> parsed(): T {
        val p = parser ?: throw IllegalStateException("no response parser on this request")
        return p.parse(text, T::class)
    }

    inline fun <reified T : Any> parsedSafe(): T? = try {
        parser?.parseSafe(text, T::class)
    } catch (t: Throwable) {
        null
    }

    override fun toString(): String = text
}
