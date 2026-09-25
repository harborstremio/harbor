package com.lagradost.cloudstream3.extractors

/** The embed hosts the layer ships with.
 *
 * Each one is the shared player page reader with a different domain, so a new host of this kind is
 * a class here plus a line in builtinExtractors. A host that needs more than this gets its own
 * file, the way DoodStream and OkRu do. */

class Filemoon : EmbedPlayerExtractor("Filemoon", "https://filemoon.sx") {
    override fun prepare(url: String): String = url.replace("/d/", "/e/")
}

/** Share links are ids, the player lives behind the embed page. */
class Mp4Upload : EmbedPlayerExtractor("Mp4Upload", "https://www.mp4upload.com") {
    override fun prepare(url: String): String {
        if (url.contains("embed-")) return url
        val id = url.trimEnd('/').substringAfterLast('/').substringBefore('.')
        if (id.isBlank()) return url
        return "https://www.mp4upload.com/embed-$id.html"
    }
}

class StreamSB : EmbedPlayerExtractor("StreamSB", "https://streamsb.net")

class MixDrop : EmbedPlayerExtractor("MixDrop", "https://mixdrop.co")

class VidHide : EmbedPlayerExtractor("VidHide", "https://vidhide.com")
