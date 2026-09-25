package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.extractorLog

/** Dailymotion, reached through the player metadata endpoint the web player itself uses. The
 * endpoint answers with the hls master plus every subtitle track, so no page scraping is needed. */
open class Dailymotion : ExtractorApi() {

    override val name: String = "Dailymotion"

    override val mainUrl: String = "https://www.dailymotion.com"

    override val requiresReferer: Boolean = false

    /** The metadata endpoint always lives on the main domain, even when the link that reached the
     * extractor was a short link or a geo player. */
    protected open val apiBase: String = "https://www.dailymotion.com"

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val id = videoId(url) ?: return
        val metadata = try {
            app.get(
                "$apiBase/player/metadata/video/$id?embedder=https%3A%2F%2Fwww.dailymotion.com%2F",
                headers = mapOf("User-Agent" to USER_AGENT),
                referer = referer ?: apiBase,
            ).text
        } catch (t: Throwable) {
            extractorLog("$name metadata failed for $id: ${t.message}")
            return
        }

        val tree = jsonTree(metadata) ?: return
        val qualities = tree.path("qualities")
        val master = qualities.path("auto").firstOrNull()?.path("url")?.asText("")
            ?: qualities.firstString("url")
        if (master.isNullOrBlank()) {
            extractorLog("$name has no stream for $id")
            return
        }

        emitStream(name, name, master, referer ?: apiBase, null, mapOf("User-Agent" to USER_AGENT), callback)

        val subtitles = tree.path("subtitles").path("data")
        val languages = subtitles.fieldNames()
        while (languages.hasNext()) {
            val tag = languages.next()
            val track = subtitles.path(tag)
            val subtitleUrl = track.path("urls").firstOrNull()?.asText("") ?: continue
            if (subtitleUrl.isBlank()) continue
            val label = track.path("label").asText("").ifBlank { tag }
            val english = SubtitleHelper.fromTagToEnglishLanguageName(tag) ?: label
            subtitleCallback(SubtitleFile(english, subtitleUrl))
        }
    }

    /** Handles the watch page, the embed page and the dai.ly short link. */
    private fun videoId(url: String): String? {
        PATTERNS.forEach { pattern ->
            pattern.find(url)?.groupValues?.getOrNull(1)?.takeIf { it.isNotBlank() }?.let { return it }
        }
        return null
    }

    private companion object {
        val PATTERNS = listOf(
            Regex("""/video/([a-zA-Z0-9]+)"""),
            Regex("""/embed/video/([a-zA-Z0-9]+)"""),
            Regex("""[?&]video=([a-zA-Z0-9]+)"""),
            Regex("""dai\.ly/([a-zA-Z0-9]+)"""),
        )
    }
}

class DailyMotionShort : Dailymotion() {
    override val name = "Dailymotion"
    override val mainUrl = "https://dai.ly"
}

class DailyMotionGeo : Dailymotion() {
    override val name = "Dailymotion"
    override val mainUrl = "https://geo.dailymotion.com"
}
