package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

class Rumble : ExtractorApi() {

    override val name: String = "Rumble"

    override val mainUrl: String = "https://rumble.com"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val id = embedId(url)
        if (id.isEmpty()) {
            extractorLog("$name found no embed id in $url")
            return
        }

        val body = try {
            app.get("$mainUrl/embedJS/u3/?request=video&ver=2&v=$id", referer = url, headers = FETCH).text
        } catch (t: Throwable) {
            extractorLog("$name record fetch failed for $id: ${t.message}")
            return
        }

        val record = jsonTree(body)
        if (record == null) {
            extractorLog("$name record for $id is not json")
            return
        }

        val playback = mapOf("User-Agent" to USER_AGENT, "Origin" to mainUrl, "Referer" to "$mainUrl/")
        var produced = false
        for (kind in RENDITIONS) {
            for ((label, stream) in renditions(record.path("ua").path(kind))) {
                produced = emitStream(name, name, stream, "$mainUrl/", label, playback, callback) || produced
            }
        }

        if (!produced) {
            val hls = record.path("u").path("hls").path("url").asText("")
            if (hls.startsWith("http")) {
                produced = emitStream(name, name, hls, "$mainUrl/", null, playback, callback)
            }
        }
        if (!produced) extractorLog("$name record for $id carries no rendition")
    }

    private fun renditions(node: JsonNode): List<Pair<String?, String>> {
        val out = ArrayList<Pair<String?, String>>()
        for (key in node.fieldNames()) {
            val stream = node.path(key).path("url").asText("")
            if (stream.startsWith("http")) out.add(key.takeIf { it.any(Char::isDigit) } to stream)
        }
        if (out.isEmpty()) {
            for (child in node) {
                val stream = child.path("url").asText("")
                if (stream.startsWith("http")) out.add(null to stream)
            }
        }
        return out
    }

    private fun embedId(url: String): String =
        url.substringBefore('?').substringBefore('#').trimEnd('/').substringAfterLast('/')

    private companion object {
        val RENDITIONS = listOf("mp4", "webm", "hls")
        val FETCH = mapOf(
            "User-Agent" to USER_AGENT,
            "Accept" to "application/json, text/plain, */*",
            "Sec-Fetch-Dest" to "empty",
            "Sec-Fetch-Mode" to "cors",
            "Sec-Fetch-Site" to "same-origin",
        )
    }
}
