package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

open class StreamHg(name: String, mainUrl: String) : EmbedPlayerExtractor(name, mainUrl) {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val embed = prepare(url)
        val page = playerPage(embed, referer ?: "$root/") ?: return
        val headers = mapOf("User-Agent" to USER_AGENT, "Origin" to root, "Referer" to "$root/")

        for (candidate in mirrors(page)) {
            val stream = absolute(embed, clean(candidate))
            if (!looksPlayable(stream)) {
                extractorLog("$name skipped $stream, which is not a url a player can open")
                continue
            }
            if (emitStream(name, name, stream, "$root/", null, headers, callback)) return
        }

        if (emitPlayerPage(name, name, embed, page, "$root/", headers, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    override fun prepare(url: String): String {
        if (url.contains("/e/")) return url
        val id = embedFileId(url) ?: return url
        return "${hostRoot(url, mainUrl)}/e/$id"
    }

    private fun mirrors(page: String): List<String> {
        val body = LINKS.find(page)?.groupValues?.get(1) ?: return emptyList()
        val tree = jsonTree(body) ?: return emptyList()

        val named = PREFERENCE.find(page)?.groupValues?.get(1)?.let { expression ->
            KEY.findAll(expression).map { it.groupValues[1] }.toList()
        }.orEmpty()

        val keys = named.ifEmpty { tree.fieldNames().asSequence().toList() }
        val values = keys.mapNotNull { tree.path(it).asText("").takeIf(String::isNotBlank) }.distinct()
        val (edge, onHost) = values.partition { it.startsWith("http", ignoreCase = true) }
        return edge + onHost
    }

    private companion object {
        val LINKS = Regex("""\blinks\s*=\s*(\{[^{}]*\})\s*;""")
        val PREFERENCE = Regex("""sources\s*:\s*\[\s*\{[^{}]*?\bfile\s*:\s*([^,}\]]+)""")
        val KEY = Regex("""links\s*\.\s*(\w+)""")
    }
}

class StreamHgSwdyu : StreamHg("StreamHG", "https://swdyu.com")
