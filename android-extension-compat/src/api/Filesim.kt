package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink

open class Filesim : EmbedPlayerExtractor("Filesim", "https://files.im") {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        var produced = 0
        val count: (ExtractorLink) -> Unit = { link ->
            produced++
            callback(link)
        }
        super.getUrl(url, referer, subtitleCallback, count)
        if (produced > 0) return
        Byse(name, mainUrl).getSafeUrl(url, referer, subtitleCallback, count)
    }
}
