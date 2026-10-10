package com.lagradost.cloudstream3.extractors

open class Vtbe : EmbedPlayerExtractor("Vtbe", "https://vtbe.to") {

    override fun prepare(url: String): String {
        if (url.contains("/embed-") || url.contains("/e/")) return url
        val id = ID.find(url)?.groupValues?.get(1) ?: return url
        return "${hostRoot(url, mainUrl)}/embed-$id.html"
    }

    private companion object {
        val ID = Regex("""/(?:file|f|d|download)/([A-Za-z0-9_-]{6,})""")
    }
}
