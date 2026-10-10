package com.lagradost.cloudstream3.extractors

open class StreamSB : EmbedPlayerExtractor("StreamSB", "https://streamsb.net") {

    override fun prepare(url: String): String {
        if (url.contains("/e/")) return url
        val id = embedFileId(url) ?: return url
        return "${hostRoot(url, mainUrl)}/e/$id.html"
    }
}
