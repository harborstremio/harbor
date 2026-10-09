package com.lagradost.nicehttp

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient

open class Session(client: OkHttpClient) : Requests(
    baseClient = client.newBuilder().cookieJar(SessionCookieJar()).build(),
)

private class SessionCookieJar : CookieJar {

    private val jar = HashMap<String, MutableMap<String, Cookie>>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) return
        synchronized(jar) {
            val host = jar.getOrPut(url.host) { HashMap() }
            for (cookie in cookies) host[cookie.name] = cookie
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return synchronized(jar) {
            val out = ArrayList<Cookie>()
            for ((host, cookies) in jar) {
                if (host != url.host && !url.host.endsWith(".$host")) continue
                val expired = cookies.values.filter { it.expiresAt < now }
                for (dead in expired) cookies.remove(dead.name)
                out.addAll(cookies.values.filter { it.matches(url) })
            }
            out
        }
    }
}
