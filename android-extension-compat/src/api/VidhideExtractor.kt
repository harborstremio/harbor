package com.lagradost.cloudstream3.extractors

open class VidhideExtractor : EmbedPlayerExtractor("VidHide", "https://vidhide.com") {

    override fun prepare(url: String): String {
        if (url.contains("/e/")) return url
        return url.replace("/d/", "/e/").replace("/f/", "/e/").replace("/v/", "/e/")
    }
}
