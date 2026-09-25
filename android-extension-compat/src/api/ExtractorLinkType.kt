package com.lagradost.cloudstream3.utils

/** What the player has to do with a link. Extensions read these entries with getstatic, so the
 * entry names and their order are part of the binary contract. */
enum class ExtractorLinkType {
    VIDEO,
    M3U8,
    DASH,
    TORRENT,
    MAGNET,
}

/** Resolves the type an extension left to inference by passing INFER_TYPE.
 *
 * Query strings carry playlist names often enough that the extension has to be ignored when it
 * sits after a "?", so the path is cut first. */
fun inferExtractorLinkType(url: String): ExtractorLinkType {
    val trimmed = url.trim()
    val path = trimmed.substringBefore('?').substringBefore('#').lowercase()
    return when {
        trimmed.startsWith("magnet:", ignoreCase = true) -> ExtractorLinkType.MAGNET
        path.endsWith(".torrent") -> ExtractorLinkType.TORRENT
        path.contains(".m3u8") || path.contains("/master.m3u") -> ExtractorLinkType.M3U8
        path.contains(".mpd") -> ExtractorLinkType.DASH
        else -> ExtractorLinkType.VIDEO
    }
}
