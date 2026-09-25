@file:JvmName("MainAPIKt")
@file:JvmMultifileClass

package com.lagradost.cloudstream3

/**
 * The builders every extension uses to hand results back. Each one fills in the provider name from
 * the receiver, resolves relative urls against the provider's `mainUrl`, then lets the extension's
 * initializer set the rest.
 */

fun newHomePageResponse(
    name: String,
    list: List<SearchResponse>,
    hasNext: Boolean? = null,
): HomePageResponse = HomePageResponse(listOf(HomePageList(name, list)), hasNext ?: list.isNotEmpty())

fun newHomePageResponse(
    list: HomePageList,
    hasNext: Boolean? = null,
): HomePageResponse = HomePageResponse(listOf(list), hasNext ?: list.list.isNotEmpty())

fun newHomePageResponse(
    list: List<HomePageList>,
    hasNext: Boolean? = null,
): HomePageResponse = HomePageResponse(list, hasNext ?: list.any { it.list.isNotEmpty() })

fun newSearchResponseList(
    list: List<SearchResponse>,
    hasNext: Boolean? = null,
): SearchResponseList = SearchResponseList(list, hasNext)

fun List<SearchResponse>.toNewSearchResponseList(
    hasNext: Boolean? = null,
): SearchResponseList = SearchResponseList(this, hasNext)

/** The handle a provider hands back here is what `loadLinks` receives later, and that arrives as a
 * string, so anything that is not one already is carried as json. */
private fun dataHandle(data: Any?): String = when (data) {
    null -> ""
    is String -> data
    else -> runCatching { mapper.writeValueAsString(data) }.getOrElse { data.toString() }
}

fun <T> MainAPI.newEpisode(
    data: T,
    initializer: Episode.() -> Unit = { },
): Episode {
    val episode = Episode(dataHandle(data))
    episode.initializer()
    return episode
}

fun MainAPI.newMovieSearchResponse(
    name: String,
    url: String,
    type: TvType = TvType.Movie,
    fix: Boolean = true,
    initializer: MovieSearchResponse.() -> Unit = { },
): MovieSearchResponse {
    val response = MovieSearchResponse(name, if (fix) fixUrl(url) else url, this.name, type)
    response.initializer()
    return response
}

fun MainAPI.newTvSeriesSearchResponse(
    name: String,
    url: String,
    type: TvType = TvType.TvSeries,
    fix: Boolean = true,
    initializer: TvSeriesSearchResponse.() -> Unit = { },
): TvSeriesSearchResponse {
    val response = TvSeriesSearchResponse(name, if (fix) fixUrl(url) else url, this.name, type)
    response.initializer()
    return response
}

fun MainAPI.newAnimeSearchResponse(
    name: String,
    url: String,
    type: TvType = TvType.Anime,
    fix: Boolean = true,
    initializer: AnimeSearchResponse.() -> Unit = { },
): AnimeSearchResponse {
    val response = AnimeSearchResponse(name, if (fix) fixUrl(url) else url, this.name, type)
    response.initializer()
    return response
}

fun MainAPI.newLiveSearchResponse(
    name: String,
    url: String,
    type: TvType = TvType.Live,
    fix: Boolean = true,
    initializer: LiveSearchResponse.() -> Unit = { },
): LiveSearchResponse {
    val response = LiveSearchResponse(name, if (fix) fixUrl(url) else url, this.name, type)
    response.initializer()
    return response
}

suspend fun MainAPI.newMovieLoadResponse(
    name: String,
    url: String,
    type: TvType,
    dataUrl: String,
    initializer: suspend MovieLoadResponse.() -> Unit = { },
): MovieLoadResponse {
    val response = MovieLoadResponse(name, url, this.name, type, dataUrl)
    response.initializer()
    return response
}

/** The same builder for builds that declare the handle as an object rather than a string. Those
 * compile to a different descriptor, so this has to be a second function rather than a change to
 * the one above: an extension asking for either signature finds it, and one asking for the other
 * would otherwise die with NoSuchMethodError the first time it loads a page. No default on the
 * initializer keeps a call from being ambiguous between the two. */
suspend fun MainAPI.newMovieLoadResponse(
    name: String,
    url: String,
    type: TvType,
    data: Any?,
    initializer: suspend MovieLoadResponse.() -> Unit,
): MovieLoadResponse {
    val response = MovieLoadResponse(name, url, this.name, type, dataHandle(data))
    response.initializer()
    return response
}

suspend fun MainAPI.newTvSeriesLoadResponse(
    name: String,
    url: String,
    type: TvType,
    episodes: List<Episode>,
    initializer: suspend TvSeriesLoadResponse.() -> Unit = { },
): TvSeriesLoadResponse {
    val response = TvSeriesLoadResponse(name, url, this.name, type, episodes)
    response.initializer()
    return response
}

suspend fun MainAPI.newAnimeLoadResponse(
    name: String,
    url: String,
    type: TvType,
    comingSoon: Boolean = false,
    initializer: suspend AnimeLoadResponse.() -> Unit = { },
): AnimeLoadResponse {
    val response = AnimeLoadResponse(name, url, this.name, type)
    response.comingSoon = comingSoon
    response.initializer()
    return response
}

suspend fun MainAPI.newLiveStreamLoadResponse(
    name: String,
    url: String,
    dataUrl: String,
    initializer: suspend LiveStreamLoadResponse.() -> Unit = { },
): LiveStreamLoadResponse {
    val response = LiveStreamLoadResponse(name, url, this.name, dataUrl)
    response.initializer()
    return response
}

suspend fun newSubtitleFile(
    lang: String,
    url: String,
    initializer: suspend SubtitleFile.() -> Unit = { },
): SubtitleFile {
    val file = SubtitleFile(lang, url)
    file.initializer()
    return file
}
