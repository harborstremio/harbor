package com.lagradost.cloudstream3.extractors

class Mp4Upload : EmbedPlayerExtractor("Mp4Upload", "https://www.mp4upload.com") {
    override fun prepare(url: String): String {
        if (url.contains("embed-")) return url
        val id = url.trimEnd('/').substringAfterLast('/').substringBefore('.')
        if (id.isBlank()) return url
        return "https://www.mp4upload.com/embed-$id.html"
    }
}

class VidHide : VidhideExtractor()
