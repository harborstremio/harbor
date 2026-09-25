package com.lagradost.cloudstream3.utils

/** One playable stream produced by an extractor.
 *
 * Extensions build these through [newExtractorLink] and then mutate the result inside the builder
 * lambda, which is why quality, referer, type, headers and extractorData are all writable while
 * the identity of the link is not. */
open class ExtractorLink(
    val source: String,
    val name: String,
    val url: String,
    var referer: String = "",
    var quality: Int = Qualities.Unknown.value,
    var type: ExtractorLinkType = ExtractorLinkType.VIDEO,
    var headers: Map<String, String> = emptyMap(),
    var extractorData: String? = null,
) {
    val isM3u8: Boolean get() = type == ExtractorLinkType.M3U8

    val isDash: Boolean get() = type == ExtractorLinkType.DASH

    /** Everything the player needs to repeat the request the extractor made. */
    fun playbackHeaders(): Map<String, String> {
        if (referer.isEmpty()) return headers
        if (headers.keys.any { it.equals("referer", ignoreCase = true) }) return headers
        return headers + ("Referer" to referer)
    }

    override fun toString(): String = "ExtractorLink($name, $quality, $type, $url)"
}
