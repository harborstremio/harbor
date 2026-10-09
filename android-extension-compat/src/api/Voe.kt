package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

open class Voe : ExtractorApi() {

    override val name: String = "Voe"

    override val mainUrl: String = "https://voe.sx"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val pageReferer = referer ?: mainUrl
        var current = url
        var page = playerPage(current, pageReferer) ?: return

        val hop = REDIRECT.find(page)?.groupValues?.get(1)
        if (hop != null && hop != current) {
            current = hop
            page = playerPage(current, pageReferer) ?: return
        }

        val config = configIn(page)
        if (config == null) {
            if (!emitPlayerPage(name, name, current, page, pageReferer, playbackHeaders(current), subtitleCallback, callback)) {
                extractorLog("$name found no config on $url")
            }
            return
        }

        val tree = jsonTree(config)
        if (tree != null) {
            for (track in tree.path("captions")) {
                val file = track.path("file").asText("").ifBlank { track.path("url").asText("") }
                if (file.isBlank()) continue
                val label = track.path("label").asText("").ifBlank { track.path("language").asText("") }
                val lang = SubtitleHelper.fromTagToEnglishLanguageName(label) ?: label.ifBlank { "Unknown" }
                subtitleCallback(SubtitleFile(lang, absolute(current, clean(file))))
            }
        }

        val headers = playbackHeaders(current)
        val hls = tree?.path("source")?.asText("").orEmpty()
        val direct = tree?.path("direct_access_url")?.asText("").orEmpty()
        var produced = false
        if (hls.isNotBlank()) {
            produced = emitStream(name, name, clean(hls), current, null, headers, callback)
        }
        if (!produced && direct.isNotBlank()) {
            produced = emitStream(name, name, clean(direct), current, null, headers, callback)
        }
        if (!produced) extractorLog("$name config held no stream for $url")
    }

    private fun playbackHeaders(pageUrl: String): Map<String, String> =
        mapOf("User-Agent" to USER_AGENT, "Referer" to pageUrl, "Origin" to hostRoot(pageUrl, mainUrl))

    private fun configIn(page: String): String? {
        val packed = PAYLOAD.find(page)?.groupValues?.get(1)?.trim() ?: return null
        var text = packed
        for (junk in JUNK) text = text.replace(junk, "")
        text = rotate(text)
        text = text.filter { it in BASE64_ALPHABET }

        val once = decodeBase64Url(text)?.toString(Charsets.UTF_8) ?: return null
        val shifted = String(CharArray(once.length) { (once[it].code - SHIFT).toChar() })
        val decoded = decodeBase64Url(shifted.reversed())?.toString(Charsets.UTF_8) ?: return null
        return decoded.takeIf { it.trimStart().startsWith("{") }
    }

    private fun rotate(text: String): String = buildString(text.length) {
        for (c in text) {
            append(
                when {
                    c in 'a'..'z' -> 'a' + (c - 'a' + 13) % 26
                    c in 'A'..'Z' -> 'A' + (c - 'A' + 13) % 26
                    else -> c
                },
            )
        }
    }

    private companion object {
        const val SHIFT = 3
        val JUNK = listOf("@$", "^^", "~@", "%?", "*~", "!!", "#&")
        const val BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
        val PAYLOAD = Regex(
            """<script[^>]+application/json[^>]*>\s*\[\s*"([^"]+)"\s*]\s*</script>""",
            RegexOption.DOT_MATCHES_ALL,
        )
        val REDIRECT = Regex("""window\.location\.href\s*=\s*['"](https?://[^'"]+)['"]""")
    }
}
