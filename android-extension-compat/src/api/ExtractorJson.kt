package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.lagradost.cloudstream3.utils.extractorLog
import java.util.Base64

/** Reading of api answers, kept separate from the html scraping because the site extractors talk
 * to real json endpoints and should not be pushed through regular expressions. */

private val mapper = ObjectMapper()

internal fun jsonTree(text: String): JsonNode? = try {
    if (text.isBlank()) null else mapper.readTree(text)
} catch (t: Throwable) {
    extractorLog("json parse failed: ${t.message}")
    null
}

/** Some players answer with base64 wrapped json, so a failed parse is worth one more try. */
internal fun jsonTreeMaybeBase64(text: String): JsonNode? {
    jsonTree(text)?.let { return it }
    val trimmed = text.trim().trim('"')
    if (trimmed.length < 8 || !trimmed.matches(Regex("""[A-Za-z0-9+/=_-]+"""))) return null
    return try {
        jsonTree(String(Base64.getDecoder().decode(trimmed.replace('-', '+').replace('_', '/'))))
    } catch (t: Throwable) {
        null
    }
}

/** Depth first search for the first string value under any of [names]. */
internal fun JsonNode.firstString(vararg names: String): String? {
    for (name in names) {
        val direct = this.path(name)
        if (direct.isTextual && direct.asText().isNotBlank()) return direct.asText()
    }
    for (child in this) {
        child.firstString(*names)?.let { return it }
    }
    return null
}

/** Serializes a request body. Building these as maps and letting the mapper escape them keeps the
 * escaping of a query that itself contains quotes out of the source. */
internal fun jsonBody(value: Any): String = try {
    mapper.writeValueAsString(value)
} catch (t: Throwable) {
    "{}"
}
