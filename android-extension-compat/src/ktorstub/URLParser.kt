package io.ktor.http

/** Fills a builder from a url string. A relative string keeps whatever the builder already holds,
 * which is how the original library lets a base url be extended. */
fun URLBuilder.takeFrom(urlString: String): URLBuilder {
    var rest = urlString.trim()
    if (rest.isEmpty()) return this

    val schemeEnd = schemeEnd(rest)
    if (schemeEnd > 0) {
        protocol = URLProtocol.createOrDefault(rest.substring(0, schemeEnd))
        rest = rest.substring(schemeEnd + 1)
    }

    if (rest.startsWith("//")) {
        rest = rest.substring(2)
        val authorityEnd = rest.indexOfFirst { it == '/' || it == '?' || it == '#' }
        val authority = if (authorityEnd < 0) rest else rest.substring(0, authorityEnd)
        rest = if (authorityEnd < 0) "" else rest.substring(authorityEnd)
        readAuthority(authority)
    }

    val hashAt = rest.indexOf('#')
    if (hashAt >= 0) {
        fragment = rest.substring(hashAt + 1)
        rest = rest.substring(0, hashAt)
    }

    val queryAt = rest.indexOf('?')
    if (queryAt >= 0) {
        readQuery(rest.substring(queryAt + 1))
        rest = rest.substring(0, queryAt)
    }

    encodedPath = rest
    return this
}

/** The index of the ':' that ends a scheme, or -1. A scheme is letters, digits, '+', '-' and '.'
 * after a leading letter, so "localhost:8080" is not one and neither is "12:30". */
private fun schemeEnd(text: String): Int {
    val colon = text.indexOf(':')
    if (colon <= 0) return -1
    if (!text[0].isLetter()) return -1
    for (i in 1 until colon) {
        val c = text[i]
        if (!c.isLetterOrDigit() && c != '+' && c != '-' && c != '.') return -1
    }
    return colon
}

private fun URLBuilder.readAuthority(authority: String) {
    var hostPort = authority
    val at = authority.lastIndexOf('@')
    if (at >= 0) {
        val credentials = authority.substring(0, at)
        val separator = credentials.indexOf(':')
        if (separator >= 0) {
            user = credentials.substring(0, separator)
            password = credentials.substring(separator + 1)
        } else {
            user = credentials
        }
        hostPort = authority.substring(at + 1)
    }

    val closingBracket = hostPort.lastIndexOf(']')
    val portSeparator = hostPort.indexOf(':', startIndex = if (closingBracket >= 0) closingBracket else 0)
    if (portSeparator >= 0) {
        host = hostPort.substring(0, portSeparator)
        port = hostPort.substring(portSeparator + 1).toIntOrNull() ?: 0
    } else {
        host = hostPort
        port = 0
    }
}

private fun URLBuilder.readQuery(query: String) {
    parameters.clear()
    if (query.isEmpty()) return
    for (pair in query.split('&')) {
        if (pair.isEmpty()) continue
        val separator = pair.indexOf('=')
        if (separator < 0) {
            parameters.append(decodeQueryPart(pair), "")
        } else {
            parameters.append(decodeQueryPart(pair.substring(0, separator)), decodeQueryPart(pair.substring(separator + 1)))
        }
    }
}

private fun decodeQueryPart(text: String): String = text.replace('+', ' ').decodeURLPart()
