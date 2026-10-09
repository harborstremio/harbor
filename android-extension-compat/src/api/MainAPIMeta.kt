@file:JvmName("MainAPIKt")
@file:JvmMultifileClass

package com.lagradost.cloudstream3

import java.util.Date

fun SearchResponse.addQuality(quality: String) {
    this.quality = getQualityFromString(quality)
}

fun getDurationFromString(input: String?): Int? {
    val clean = input?.lowercase()?.replace(PARENS, "")?.trim() ?: return null
    if (clean.isEmpty()) return null

    val hours = HOURS.find(clean)?.groupValues?.get(1)?.toIntOrNull()
    val minutes = MINUTES.find(clean)?.groupValues?.get(1)?.toIntOrNull()
    if (hours != null || minutes != null) {
        return ((hours ?: 0) * 60 + (minutes ?: 0)).takeIf { it > 0 }
    }

    CLOCK.find(clean)?.let { match ->
        val h = match.groupValues[1].toIntOrNull() ?: 0
        val m = match.groupValues[2].toIntOrNull() ?: 0
        return (h * 60 + m).takeIf { it > 0 }
    }

    return clean.toIntOrNull()?.takeIf { it > 0 }
}

fun imdbUrlToIdNullable(url: String?): String? {
    if (url == null) return null
    return IMDB_ID.find(url)?.groupValues?.get(1)
}

fun Episode.addDate(date: Date?) {
    if (date != null) this.date = date.time
}

fun AnimeSearchResponse.addDubStatus(status: DubStatus, episodes: Int? = null) {
    val dubbed = status == DubStatus.Dubbed
    addDubStatus(
        dubExist = dubbed,
        subExist = !dubbed,
        dubEpisodes = if (dubbed) episodes else null,
        subEpisodes = if (dubbed) null else episodes,
    )
}

fun AnimeSearchResponse.addDubStatus(isDub: Boolean, episodes: Int? = null) {
    addDubStatus(if (isDub) DubStatus.Dubbed else DubStatus.Subbed, episodes)
}

private val PARENS = Regex("""[()]""")
private val HOURS = Regex("""(\d+)\s*(?:h|hour|hr)""")
private val MINUTES = Regex("""(\d+)\s*(?:m|min)""")
private val CLOCK = Regex("""(\d+):(\d{2})""")
private val IMDB_ID = Regex("""(tt\d+)""")
