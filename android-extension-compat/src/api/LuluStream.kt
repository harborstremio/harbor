package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class LuluStream : EmbedPlayerExtractor("LuluStream", "https://lulustream.com") {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val embed = prepare(url)
        val root = hostRoot(embed, mainUrl)
        val pageReferer = referer ?: root
        val page = playerPage(embed, pageReferer, mapOf("Accept-Language" to "")) ?: return
        val headers = mapOf("Origin" to root, "User-Agent" to USER_AGENT)
        if (emitPlayerPage(name, name, embed, page, pageReferer, headers, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    override fun prepare(url: String): String {
        if (url.contains("/e/")) return url
        val id = embedFileId(url) ?: return url
        return "${hostRoot(url, mainUrl)}/e/$id"
    }
}
