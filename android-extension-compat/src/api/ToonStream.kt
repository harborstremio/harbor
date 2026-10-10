package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.hostOf
import com.lagradost.cloudstream3.utils.loadExtractor

open class ToonStream : ExtractorApi() {

    override val name: String = "ToonStream"

    override val mainUrl: String = "https://toonstream.vip"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val page = playerPage(url, referer ?: hostRoot(url, mainUrl))
        if (page == null) {
            extractorLog("$name page did not answer for $url")
            return
        }

        val here = hostOf(url)
        val frames = FRAME.findAll(page)
            .map { clean(it.groupValues[1]) }
            .filter { it.startsWith("http") && hostOf(it) != here }
            .distinct()
            .take(MAX_FRAMES)
            .toList()

        if (frames.isEmpty()) {
            extractorLog("$name found no frames on $url")
            return
        }

        var produced = 0
        val counted: (ExtractorLink) -> Unit = {
            produced++
            callback(it)
        }
        for (frame in frames) {
            try {
                loadExtractor(frame, url, subtitleCallback, counted)
            } catch (t: Throwable) {
                extractorLog("$name mirror failed for $frame: ${t.message}")
            }
            if (produced > 0) return
        }
        extractorLog("$name resolved none of ${frames.size} mirrors on $url")
    }

    private companion object {
        const val MAX_FRAMES = 8

        val FRAME = Regex(
            """<iframe[^>]+(?:data-src|src)\s*=\s*["']([^"']+)["']""",
            RegexOption.IGNORE_CASE,
        )
    }
}

class ToonStreamOne : ToonStream() {

    override val name = "ToonStream"

    override val mainUrl = "https://toonstream.one"
}
