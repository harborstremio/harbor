package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink

class YourUpload : EmbedPlayerExtractor("YourUpload", "https://www.yourupload.com") {

    override fun prepare(url: String): String = url.replace("/watch/", "/embed/")

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) = super.getUrl(url, mainUrl, subtitleCallback, callback)
}
