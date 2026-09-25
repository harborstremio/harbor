package com.lagradost.cloudstream3.utils

import java.net.URI
import java.net.URL
import java.net.URLEncoder

/** Two url escapers with different jobs: encodeUri escapes a value for use inside a query string,
 * encodeUrl repairs a whole url whose path or query contains raw spaces or unicode. */
object StringUtils {

    fun String.encodeUri(): String = try {
        URLEncoder.encode(this, "UTF-8")
    } catch (t: Throwable) {
        this
    }

    fun String.encodeUrl(): String = try {
        val url = URL(this)
        URI(url.protocol, url.userInfo, url.host, url.port, url.path, url.query, url.ref).toURL().toString()
    } catch (t: Throwable) {
        this
    }
}
