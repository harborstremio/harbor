package android.webkit

import java.net.URI
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** A working cookie jar. The clearance flows poll this after every page load and treat what comes
 * back as the session they will reuse for later requests, so storage, host matching and expiry have
 * to behave, and a stub that always answered null would make those loops spin until they time out. */
class CookieManager private constructor() {

    private class Entry(
        val name: String,
        var value: String,
        val domain: String,
        val path: String,
        var expiresAt: Long,
        var secure: Boolean
    )

    private val jar = ArrayList<Entry>()
    private var accepting = true
    private val thirdParty = HashMap<Int, Boolean>()

    fun setAcceptCookie(accept: Boolean) {
        synchronized(jar) { accepting = accept }
    }

    fun acceptCookie(): Boolean = synchronized(jar) { accepting }

    fun setAcceptThirdPartyCookies(view: WebView?, accept: Boolean) {
        if (view == null) return
        synchronized(jar) { thirdParty[System.identityHashCode(view)] = accept }
    }

    fun acceptThirdPartyCookies(view: WebView?): Boolean {
        if (view == null) return false
        return synchronized(jar) { thirdParty[System.identityHashCode(view)] ?: false }
    }

    fun setCookie(url: String?, value: String?) {
        val host = hostOf(url) ?: return
        store(host, pathOf(url), value)
    }

    fun setCookie(url: String?, value: String?, callback: ValueCallback<Boolean>?) {
        setCookie(url, value)
        callback?.onReceiveValue(true)
    }

    fun getCookie(url: String?): String? {
        val host = hostOf(url) ?: return null
        val path = pathOf(url)
        val now = System.currentTimeMillis()
        val picked = LinkedHashMap<String, String>()
        synchronized(jar) {
            jar.removeAll { it.expiresAt > 0L && it.expiresAt < now }
            for (e in jar) {
                if (!domainMatches(host, e.domain)) continue
                if (!path.startsWith(e.path)) continue
                picked[e.name] = e.value
            }
        }
        if (picked.isEmpty()) return null
        return picked.entries.joinToString("; ") { it.key + "=" + it.value }
    }

    fun hasCookies(): Boolean = synchronized(jar) { jar.isNotEmpty() }

    fun removeAllCookies(callback: ValueCallback<Boolean>?) {
        synchronized(jar) { jar.clear() }
        callback?.onReceiveValue(true)
    }

    fun removeSessionCookies(callback: ValueCallback<Boolean>?) {
        synchronized(jar) { jar.removeAll { it.expiresAt == 0L } }
        callback?.onReceiveValue(true)
    }

    /** Nothing is written to disk, so there is no buffer to push. Kept because page code calls it
     * before reading the jar and expects the read that follows to see everything. */
    fun flush() {}

    internal fun storeAll(url: String?, setCookieHeaders: List<String>) {
        val host = hostOf(url) ?: return
        val path = pathOf(url)
        for (h in setCookieHeaders) store(host, path, h)
    }

    private fun store(host: String, requestPath: String, raw: String?) {
        val text = raw?.trim().orEmpty()
        if (text.isEmpty()) return
        synchronized(jar) { if (!accepting) return }

        val parts = text.split(';')
        val pair = parts[0]
        val eq = pair.indexOf('=')
        if (eq <= 0) return
        val name = pair.substring(0, eq).trim()
        val value = pair.substring(eq + 1).trim()
        if (name.isEmpty()) return

        var domain = host
        var path = defaultPath(requestPath)
        var expires = 0L
        var secure = false
        for (i in 1 until parts.size) {
            val attr = parts[i].trim()
            val idx = attr.indexOf('=')
            val key = (if (idx < 0) attr else attr.substring(0, idx)).trim().lowercase(Locale.ROOT)
            val av = if (idx < 0) "" else attr.substring(idx + 1).trim()
            when (key) {
                "domain" -> if (av.isNotEmpty()) domain = av.removePrefix(".").lowercase(Locale.ROOT)
                "path" -> if (av.startsWith("/")) path = av
                "secure" -> secure = true
                "max-age" -> {
                    val secs = av.toLongOrNull()
                    if (secs != null) expires =
                        if (secs <= 0L) 1L else System.currentTimeMillis() + secs * 1000L
                }
                "expires" -> if (expires == 0L) expires = parseExpires(av)
            }
        }
        if (!domainMatches(host, domain)) domain = host

        synchronized(jar) {
            val existing = jar.firstOrNull { it.name == name && it.domain == domain && it.path == path }
            if (expires > 0L && expires <= System.currentTimeMillis()) {
                if (existing != null) jar.remove(existing)
                return
            }
            if (existing == null) {
                jar.add(Entry(name, value, domain, path, expires, secure))
            } else {
                existing.value = value
                existing.expiresAt = expires
                existing.secure = secure
            }
        }
    }

    private fun defaultPath(requestPath: String): String {
        val cut = requestPath.lastIndexOf('/')
        if (cut <= 0) return "/"
        return requestPath.substring(0, cut)
    }

    private fun parseExpires(text: String): Long {
        if (text.isEmpty()) return 0L
        for (f in EXPIRY_FORMATS) {
            try {
                return ZonedDateTime.parse(text, f).toInstant().toEpochMilli()
            } catch (_: Exception) {
            }
        }
        return 0L
    }

    private fun domainMatches(host: String, domain: String): Boolean =
        host == domain || host.endsWith(".$domain")

    private fun hostOf(url: String?): String? {
        val text = url?.trim().orEmpty()
        if (text.isEmpty()) return null
        val host = try {
            val hasScheme = text.contains("://")
            URI(if (hasScheme) text else "http://$text").host
        } catch (_: Exception) {
            null
        }
        val cleaned = (host ?: text.substringBefore('/').substringBefore('?'))
            .removePrefix(".")
            .lowercase(Locale.ROOT)
        return cleaned.ifEmpty { null }
    }

    private fun pathOf(url: String?): String {
        val text = url?.trim().orEmpty()
        if (!text.contains("://")) return "/"
        val path = try {
            URI(text).path
        } catch (_: Exception) {
            null
        }
        return if (path.isNullOrEmpty()) "/" else path
    }

    companion object {
        private val INSTANCE = CookieManager()

        private val EXPIRY_FORMATS = listOf(
            DateTimeFormatter.RFC_1123_DATE_TIME,
            DateTimeFormatter.ofPattern("EEE, dd-MMM-yyyy HH:mm:ss zzz", Locale.US),
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US)
        )

        @JvmStatic
        fun getInstance(): CookieManager = INSTANCE

        @JvmStatic
        fun setAcceptFileSchemeCookies(accept: Boolean) {}

        @JvmStatic
        fun allowFileSchemeCookies(): Boolean = false
    }
}
