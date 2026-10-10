package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

class DTube : ExtractorApi() {

    override val name: String = "DTube"

    override val mainUrl: String = "https://play.d.tube"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val asked = videoId(url)
        if (asked.isEmpty()) {
            extractorLog("$name found no video id in $url")
            return
        }

        val body = try {
            app.get(
                "$CATALOGUE/videos/$asked",
                referer = "$mainUrl/",
                headers = mapOf("User-Agent" to USER_AGENT),
            ).text
        } catch (t: Throwable) {
            extractorLog("$name record fetch failed for $asked: ${t.message}")
            return
        }

        val stored = jsonTree(body)?.path("id")?.asText("").orEmpty()
        if (stored.isBlank()) {
            extractorLog("$name has no record for $asked")
            return
        }

        val playback = mapOf("User-Agent" to USER_AGENT, "Origin" to mainUrl, "Referer" to "$mainUrl/")
        val master = "$DELIVERY/videos/$stored/master.m3u8"
        if (!emitStream(name, name, master, "$mainUrl/", null, playback, callback)) {
            extractorLog("$name master for $stored carried no variant")
        }
    }

    private fun videoId(url: String): String {
        for (part in url.substringAfter('?', "").substringBefore('#').split('&')) {
            if (part.startsWith("v=")) return part.removePrefix("v=")
        }
        val path = url.substringAfter("://", "").substringAfter('/', "")
            .substringBefore('?').substringBefore('#')
        return path.trimEnd('/').substringAfterLast('/')
    }

    private companion object {
        const val CATALOGUE = "https://api.d.tube"
        const val DELIVERY = "https://nas1.d.tube"
    }
}
