package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

class Streamlare : EmbedPlayerExtractor("Streamlare", "https://streamlare.com") {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val id = url.substringBefore('?').substringBefore('#').trimEnd('/').substringAfterLast('/')
        if (id.isNotEmpty() && emitFromApi(id, url, callback)) return
        super.getUrl(url, referer, subtitleCallback, callback)
    }

    private suspend fun emitFromApi(id: String, pageUrl: String, callback: (ExtractorLink) -> Unit): Boolean {
        val body = try {
            app.post(
                "$mainUrl/api/video/stream/get",
                referer = pageUrl,
                headers = mapOf("User-Agent" to USER_AGENT, "X-Requested-With" to "XMLHttpRequest"),
                json = mapOf("id" to id),
            ).text
        } catch (t: Throwable) {
            extractorLog("$name stream request failed for $id: ${t.message}")
            return false
        }

        val result = jsonTree(body)?.path("result")
        if (result == null || !result.isObject) return false

        val playback = mapOf("User-Agent" to USER_AGENT, "Referer" to "$mainUrl/")
        var produced = false
        for (entry in result) {
            val file = entry.path("file").asText("")
            if (file.isBlank()) continue
            val label = entry.path("label").asText("").ifBlank { null }
            produced = emitStream(name, name, clean(file), "$mainUrl/", label, playback, callback) || produced
        }
        return produced
    }
}
