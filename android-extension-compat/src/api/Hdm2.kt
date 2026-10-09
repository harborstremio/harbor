package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.M3u8Helper
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

class Hdm2 : ExtractorApi() {

    override val name: String = "Hdm2"

    override val mainUrl: String = "https://hdm2.biz"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val page = playerPage(url, referer ?: "$root/") ?: return
        val stream = ATTR_STREAM.find(page)?.groupValues?.get(1)
        if (stream.isNullOrBlank()) {
            extractorLog("$name found no stream attribute on $url")
            return
        }

        emitTracks(page, url, subtitleCallback)

        val master = absolute(url, clean(unescapeHtml(stream)))
        val playback = mapOf("Origin" to root, "Referer" to url, "User-Agent" to USER_AGENT)
        M3u8Helper.generateM3u8(name, master, url, null, playback, name).forEach(callback)
    }

    private fun emitTracks(page: String, pageUrl: String, subtitleCallback: (SubtitleFile) -> Unit) {
        val raw = ATTR_TRACKS.find(page)?.groupValues?.get(1) ?: return
        val tracks = unescapeHtml(raw)
        for (entry in Regex("""\{[^{}]*\}""").findAll(tracks)) {
            val body = entry.value
            val file = field(body, "file") ?: continue
            if (field(body, "kind")?.contains("thumb", ignoreCase = true) == true) continue
            val label = field(body, "label").orEmpty()
            val lang = SubtitleHelper.fromTagToEnglishLanguageName(label) ?: label.ifBlank { "Unknown" }
            try {
                subtitleCallback(SubtitleFile(lang, absolute(pageUrl, clean(file))))
            } catch (t: Throwable) {
                extractorLog("$name subtitle emit failed: ${t.message}")
            }
        }
    }

    private fun unescapeHtml(raw: String): String = raw
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&#39;", "'")
        .replace("&amp;", "&")

    private companion object {
        val ATTR_STREAM = Regex("""data-stream-url\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
        val ATTR_TRACKS = Regex("""data-player-tracks\s*=\s*["']([^"']*)["']""", RegexOption.IGNORE_CASE)
    }
}
