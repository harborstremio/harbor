package io.ktor.http

/** Parses a url the way the original library does: nothing is decoded on the way in, because an
 * extension that re-sends the path has to send back exactly what it was given. */
fun Url(urlString: String): Url = URLBuilder(urlString).build()

fun URLBuilder(urlString: String): URLBuilder = URLBuilder().takeFrom(urlString)

class URLBuilder {

    var protocol: URLProtocol = URLProtocol.HTTP

    var host: String = ""

    var port: Int = 0

    var encodedPath: String = ""

    var fragment: String = ""

    var user: String? = null

    var password: String? = null

    val parameters: ParametersBuilder = ParametersBuilder()

    fun build(): Url = Url(
        protocol = protocol,
        host = host,
        specifiedPort = port,
        encodedPath = encodedPath,
        parameters = parameters.build(),
        fragment = fragment,
        user = user,
        password = password,
        text = buildString(),
    )

    fun buildString(): String {
        val out = StringBuilder()
        out.append(protocol.name).append("://")
        val credentials = user
        if (!credentials.isNullOrEmpty()) {
            out.append(credentials)
            password?.takeIf { it.isNotEmpty() }?.let { out.append(':').append(it) }
            out.append('@')
        }
        out.append(host)
        if (port > 0 && port != protocol.defaultPort) out.append(':').append(port)
        if (encodedPath.isNotEmpty() && !encodedPath.startsWith("/")) out.append('/')
        out.append(encodedPath)
        val query = parameters.build().formUrlEncode()
        if (query.isNotEmpty()) out.append('?').append(query)
        if (fragment.isNotEmpty()) out.append('#').append(fragment)
        return out.toString()
    }

    override fun toString(): String = buildString()
}
