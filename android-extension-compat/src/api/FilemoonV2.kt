package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.extractorLog

open class FilemoonV2 : EmbedPlayerExtractor("FilemoonV2", "https://filemoon.to") {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        sidecarSubtitles(url, referer, subtitleCallback)
        super.getUrl(url, referer, subtitleCallback, callback)
    }

    override fun prepare(url: String): String {
        val bare = url.substringBefore('?')
        if (bare.contains("/e/")) return url
        val id = ID.find(bare)?.groupValues?.get(1) ?: return url
        return "${hostRoot(url, mainUrl)}/e/$id" + url.substring(bare.length)
    }

    private suspend fun sidecarSubtitles(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
    ) {
        val sidecar = SUB_INFO.find(url)?.groupValues?.get(1)?.let { clean(java.net.URLDecoder.decode(it, "UTF-8")) }
        if (sidecar.isNullOrBlank() || !sidecar.startsWith("http")) return
        val text = try {
            app.get(sidecar, referer = referer ?: mainUrl, headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name sidecar failed for $sidecar: ${t.message}")
            return
        }
        val tree = jsonTree(text) ?: return
        for (track in tree) {
            val file = track.path("file").asText("").takeIf { it.isNotBlank() } ?: continue
            val label = track.path("label").asText("").ifBlank { "Unknown" }
            val english = SubtitleHelper.fromTagToEnglishLanguageName(label) ?: label
            try {
                subtitleCallback(SubtitleFile(english, clean(file)))
            } catch (t: Throwable) {
                extractorLog("$name subtitle emit failed for $file: ${t.message}")
            }
        }
    }

    private companion object {
        val ID = Regex("""/(?:d|download|f|file)/([A-Za-z0-9_-]{6,})""")
        val SUB_INFO = Regex("""[?&]sub\.info=([^&]+)""")
    }
}
