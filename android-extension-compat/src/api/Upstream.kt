package com.lagradost.cloudstream3.extractors

open class Upstream : EmbedPlayerExtractor("Upstream", "https://upstream.to") {

    override fun prepare(url: String): String {
        if (url.contains("/embed-")) return url
        val id = ID.find(url)?.groupValues?.get(1) ?: return url
        return "${hostRoot(url, mainUrl)}/embed-$id.html"
    }

    private companion object {
        val ID = Regex("""upstream\.to/(?:embed-)?([A-Za-z0-9_-]{6,})""")
    }
}
