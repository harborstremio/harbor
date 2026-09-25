package android.net

import java.net.URLDecoder
import java.net.URLEncoder

/** Keeps the exact text it was parsed from, because extensions compare toString against strings
 * they built themselves and any normalising would break that comparison. */
open class Uri(private val raw: String) {

    private val schemeEnd: Int = run {
        val colon = raw.indexOf(':')
        val slash = raw.indexOf('/')
        if (colon > 0 && (slash < 0 || colon < slash)) colon else -1
    }

    private val hierarchical: String =
        if (schemeEnd >= 0) raw.substring(schemeEnd + 1) else raw

    private val afterAuthority: String
    private val authority: String?

    init {
        if (hierarchical.startsWith("//")) {
            val rest = hierarchical.substring(2)
            val cut = rest.indexOfFirst { it == '/' || it == '?' || it == '#' }
            authority = if (cut < 0) rest else rest.substring(0, cut)
            afterAuthority = if (cut < 0) "" else rest.substring(cut)
        } else {
            authority = null
            afterAuthority = hierarchical
        }
    }

    open fun getScheme(): String? = if (schemeEnd > 0) raw.substring(0, schemeEnd) else null

    open fun getAuthority(): String? = authority

    open fun getUserInfo(): String? = authority?.substringBefore('@', "")?.ifEmpty { null }

    open fun getHost(): String? {
        val hostPort = authority?.substringAfterLast('@') ?: return null
        if (hostPort.startsWith("[")) return hostPort.substringBefore(']').removePrefix("[")
        return hostPort.substringBefore(':').ifEmpty { null }
    }

    open fun getPort(): Int {
        val hostPort = authority?.substringAfterLast('@') ?: return -1
        val tail = if (hostPort.startsWith("[")) hostPort.substringAfter(']') else hostPort
        if (!tail.contains(':')) return -1
        return tail.substringAfterLast(':').toIntOrNull() ?: -1
    }

    open fun getPath(): String? = afterAuthority.substringBefore('#').substringBefore('?')

    open fun getQuery(): String? {
        val withoutFragment = afterAuthority.substringBefore('#')
        return if (withoutFragment.contains('?')) withoutFragment.substringAfter('?') else null
    }

    open fun getFragment(): String? =
        if (afterAuthority.contains('#')) afterAuthority.substringAfter('#') else null

    open fun getPathSegments(): List<String> =
        getPath().orEmpty().split('/').filter { it.isNotEmpty() }

    open fun getLastPathSegment(): String? = getPathSegments().lastOrNull()

    open fun getQueryParameter(key: String): String? {
        for (pair in queryPairs()) {
            if (decode(pair.substringBefore('=')) == key) return decode(pair.substringAfter('=', ""))
        }
        return null
    }

    open fun getQueryParameters(key: String): List<String> =
        queryPairs().filter { decode(it.substringBefore('=')) == key }
            .map { decode(it.substringAfter('=', "")) }

    open fun getQueryParameterNames(): Set<String> =
        queryPairs().map { decode(it.substringBefore('=')) }.toSet()

    open fun isAbsolute(): Boolean = schemeEnd > 0

    open fun isHierarchical(): Boolean = hierarchical.startsWith("/") || hierarchical.startsWith("//")

    override fun toString(): String = raw

    override fun equals(other: Any?): Boolean = other is Uri && other.raw == raw

    override fun hashCode(): Int = raw.hashCode()

    private fun queryPairs(): List<String> =
        getQuery().orEmpty().split('&').filter { it.isNotEmpty() }

    companion object {

        @JvmField
        val EMPTY: Uri = Uri("")

        @JvmStatic
        fun parse(uriString: String): Uri = Uri(uriString)

        @JvmStatic
        fun encode(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

        @JvmStatic
        fun decode(value: String): String = try {
            URLDecoder.decode(value, "UTF-8")
        } catch (error: IllegalArgumentException) {
            value
        }
    }
}
