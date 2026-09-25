@file:JvmName("MainAPIKt")
@file:JvmMultifileClass

package com.lagradost.cloudstream3

import java.text.SimpleDateFormat
import java.util.Locale

fun AnimeSearchResponse.addDubStatus(
    dubExist: Boolean,
    subExist: Boolean,
    dubEpisodes: Int? = null,
    subEpisodes: Int? = null,
) {
    val statuses = dubStatus ?: mutableSetOf()
    if (dubExist) statuses.add(DubStatus.Dubbed)
    if (subExist) statuses.add(DubStatus.Subbed)
    dubStatus = statuses
    if (dubEpisodes != null && dubEpisodes > 0) this.dubEpisodes = dubEpisodes
    if (subEpisodes != null && subEpisodes > 0) this.subEpisodes = subEpisodes
}

fun AnimeSearchResponse.addDub(episodes: Int?) {
    if (episodes == null || episodes <= 0) return
    addDubStatus(dubExist = true, subExist = false, dubEpisodes = episodes)
}

fun AnimeSearchResponse.addSub(episodes: Int?) {
    if (episodes == null || episodes <= 0) return
    addDubStatus(dubExist = false, subExist = true, subEpisodes = episodes)
}

fun AnimeLoadResponse.addEpisodes(status: DubStatus, episodes: List<Episode>?) {
    if (episodes.isNullOrEmpty()) return
    this.episodes[status] = episodes
}

/** Air dates are free text per site, and a page that fails to parse one is still a good page. */
fun Episode.addDate(date: String?, format: String = "yyyy-MM-dd") {
    val text = date?.trim()
    if (text.isNullOrEmpty()) return
    val parsed = runCatching { SimpleDateFormat(format, Locale.ROOT).parse(text)?.time }.getOrNull()
    if (parsed != null) this.date = parsed
}
