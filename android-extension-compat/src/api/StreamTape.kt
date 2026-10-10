package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class StreamTape : ExtractorApi() {

    override val name: String = "StreamTape"

    override val mainUrl: String = "https://streamtape.com"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val embed = embedUrl(url)
        val pageReferer = referer ?: mainUrl
        val headers = mapOf("User-Agent" to USER_AGENT)
        val page = playerPage(embed, pageReferer, headers) ?: return

        val direct = robotLink(page)
        if (direct != null) {
            emitStream(name, name, direct, pageReferer, null, headers, callback)
            return
        }

        if (emitPlayerPage(name, name, embed, page, pageReferer, headers, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    private fun embedUrl(url: String): String {
        if (url.contains("/e/")) return url
        val id = FILE_ID.find(url)?.groupValues?.get(2) ?: return url
        return "${hostRoot(url, mainUrl)}/e/$id"
    }

    private fun robotLink(page: String): String? {
        val parts = ASSIGN.find(page)?.groupValues ?: return null
        val head = parts[1]
        val tail = parts[2]
        val chain = parts[3]
        val drop = if (chain.isBlank()) {
            DEFAULT_DROP
        } else {
            DROP.findAll(chain).sumOf { it.groupValues[1].toIntOrNull() ?: 0 }
        }
        if (head.isBlank() || drop < 0 || tail.length < drop) return null
        val full = clean(head + tail.substring(drop))
        return if (VIDEO.containsMatchIn(full)) full else null
    }

    private companion object {
        const val DEFAULT_DROP = 3
        val FILE_ID = Regex("""/(v|e|f)/([A-Za-z0-9_-]{6,})""")
        val ASSIGN = Regex(
            """robotlink['"]?\)\.innerHTML\s*=\s*['"]([^'"]*)['"]\s*\+\s*\(?\s*['"]([^'"]*)['"]\s*\)?((?:\s*\.substring\(\s*\d+\s*\))*)""",
            RegexOption.IGNORE_CASE,
        )
        val DROP = Regex("""\.substring\(\s*(\d+)\s*\)""")
        val VIDEO = Regex("""^https://[A-Za-z0-9.-]+/get_video\?""")
    }
}
