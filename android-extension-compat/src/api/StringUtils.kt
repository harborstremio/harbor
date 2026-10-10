package com.lagradost.cloudstream3.utils

import java.net.URI
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder

object StringUtils {

    fun String.encodeUri(): String = try {
        URLEncoder.encode(this, "UTF-8")
    } catch (t: Throwable) {
        this
    }

    fun String.decodeUri(): String = try {
        URLDecoder.decode(this, "UTF-8")
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
