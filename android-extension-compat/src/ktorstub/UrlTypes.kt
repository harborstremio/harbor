package io.ktor.http

/** The URL types extensions link against.
 *
 * Extensions reach for these to take a link apart, so what matters is that the parts come back
 * the same way the original library returns them: the path still encoded, the query already split,
 * and the scheme carrying its default port. */
class URLProtocol(val name: String, val defaultPort: Int) {

    override fun equals(other: Any?): Boolean = other is URLProtocol && other.name == name

    override fun hashCode(): Int = name.hashCode()

    override fun toString(): String = name

    companion object {
        val HTTP = URLProtocol("http", 80)
        val HTTPS = URLProtocol("https", 443)
        val WS = URLProtocol("ws", 80)
        val WSS = URLProtocol("wss", 443)
        val SOCKS = URLProtocol("socks", 1080)

        private val known = listOf(HTTP, HTTPS, WS, WSS, SOCKS).associateBy { it.name }

        fun createOrDefault(name: String): URLProtocol {
            val lower = name.lowercase()
            return known[lower] ?: URLProtocol(lower, 0)
        }
    }
}

/** A query string, kept as the multimap it is: one name can carry several values. */
interface Parameters {

    val names: Set<String>

    val entries: Set<Map.Entry<String, List<String>>>

    fun getAll(name: String): List<String>?

    operator fun get(name: String): String? = getAll(name)?.firstOrNull()

    fun contains(name: String): Boolean = getAll(name) != null

    fun isEmpty(): Boolean = names.isEmpty()

    companion object {
        val Empty: Parameters = ParametersMap(emptyMap())
    }
}

class ParametersMap(private val values: Map<String, List<String>>) : Parameters {

    override val names: Set<String> get() = values.keys

    override val entries: Set<Map.Entry<String, List<String>>> get() = values.entries

    override fun getAll(name: String): List<String>? = values[name]

    override fun toString(): String = formUrlEncode()
}

class ParametersBuilder {

    private val values = LinkedHashMap<String, MutableList<String>>()

    fun append(name: String, value: String): ParametersBuilder {
        values.getOrPut(name) { ArrayList() }.add(value)
        return this
    }

    fun appendAll(source: Parameters): ParametersBuilder {
        for (entry in source.entries) entry.value.forEach { append(entry.key, it) }
        return this
    }

    fun remove(name: String): ParametersBuilder {
        values.remove(name)
        return this
    }

    fun clear() {
        values.clear()
    }

    fun isEmpty(): Boolean = values.isEmpty()

    fun build(): Parameters = ParametersMap(LinkedHashMap(values))
}

class Url internal constructor(
    val protocol: URLProtocol,
    val host: String,
    val specifiedPort: Int,
    val encodedPath: String,
    val parameters: Parameters,
    val fragment: String,
    val user: String?,
    val password: String?,
    private val text: String,
) {
    val port: Int get() = if (specifiedPort > 0) specifiedPort else protocol.defaultPort

    val encodedQuery: String get() = parameters.formUrlEncode()

    val fullPath: String
        get() {
            val query = encodedQuery
            return if (query.isEmpty()) encodedPath else "$encodedPath?$query"
        }

    override fun equals(other: Any?): Boolean = other is Url && other.text == text

    override fun hashCode(): Int = text.hashCode()

    override fun toString(): String = text
}
