package com.harbor.capstan

import com.lagradost.cloudstream3.AnimeLoadResponse
import com.lagradost.cloudstream3.Episode
import com.lagradost.cloudstream3.LiveStreamLoadResponse
import com.lagradost.cloudstream3.LoadResponse
import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.MovieLoadResponse
import com.lagradost.cloudstream3.SearchResponse
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.TvSeriesLoadResponse
import com.lagradost.cloudstream3.utils.ExtractorLink

internal object ResultMapping {

    fun provider(api: MainAPI): ProviderInfo = ProviderInfo(
        name = api.name,
        mainUrl = api.mainUrl,
        lang = api.lang,
        supportedTypes = api.supportedTypes.map { it.name },
        hasMainPage = api.hasMainPage,
        hasQuickSearch = api.hasQuickSearch,
        hasDownloadSupport = api.hasDownloadSupport,
        instantLinkLoading = api.instantLinkLoading,
    )

    fun search(item: SearchResponse): SearchItem = SearchItem(
        name = item.name,
        url = item.url,
        apiName = item.apiName,
        type = item.type?.name,
        posterUrl = item.posterUrl,
        posterHeaders = item.posterHeaders.orEmpty(),
        quality = item.quality?.name,
        scoreOutOf10 = item.score?.toDouble(10),
    )

    fun media(response: LoadResponse): MediaItem = MediaItem(
        name = response.name,
        url = response.url,
        apiName = response.apiName,
        type = response.type.name,
        posterUrl = response.posterUrl,
        backgroundPosterUrl = response.backgroundPosterUrl,
        year = response.year,
        plot = response.plot,
        tags = response.tags.orEmpty(),
        durationMinutes = response.duration,
        contentRating = response.contentRating,
        scoreOutOf10 = response.score?.toDouble(10),
        comingSoon = response.comingSoon,
        playableData = playableData(response),
        episodes = episodes(response),
        recommendations = response.recommendations.orEmpty().map(::search),
        actors = response.actors.orEmpty().map { it.actor.name },
        trailerUrls = response.trailers.map { it.extractorUrl },
        syncIds = response.syncData.toMap(),
    )

    fun link(link: ExtractorLink): StreamLink = StreamLink(
        source = link.source,
        name = link.name,
        url = link.url,
        referer = link.referer,
        quality = link.quality,
        type = link.type.name,
        headers = link.playbackHeaders(),
    )

    fun subtitle(file: SubtitleFile): SubtitleItem =
        SubtitleItem(lang = file.lang, url = file.url, headers = file.headers)

    private fun playableData(response: LoadResponse): String? = when (response) {
        is MovieLoadResponse -> response.dataUrl
        is LiveStreamLoadResponse -> response.dataUrl
        else -> null
    }

    private fun episodes(response: LoadResponse): List<EpisodeItem> = when (response) {
        is TvSeriesLoadResponse -> response.episodes.map { episode(it, "") }
        is AnimeLoadResponse -> response.episodes.entries
            .sortedBy { it.key.id }
            .flatMap { entry -> entry.value.map { episode(it, entry.key.name) } }
        else -> emptyList()
    }

    private fun episode(source: Episode, track: String): EpisodeItem = EpisodeItem(
        data = source.data,
        name = source.name,
        season = source.season,
        episode = source.episode,
        posterUrl = source.posterUrl,
        description = source.description,
        runtimeMinutes = source.runTime,
        airDate = source.date,
        track = track,
    )
}
