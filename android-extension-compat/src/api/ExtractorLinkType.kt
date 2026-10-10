package com.lagradost.cloudstream3.utils

enum class ExtractorLinkType {
    VIDEO,
    M3U8,
    DASH,
    TORRENT,
    MAGNET,
}

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
