package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.lagradost.cloudstream3.utils.extractorLog
import java.util.Base64

private val mapper = ObjectMapper()

internal fun jsonTree(text: String): JsonNode? = try {
    if (text.isBlank()) null else mapper.readTree(text)
} catch (t: Throwable) {
    extractorLog("json parse failed: ${t.message}")
    null
}

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

internal fun jsonBody(value: Any): String = try {
    mapper.writeValueAsString(value)
} catch (t: Throwable) {
    "{}"
}
