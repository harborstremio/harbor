package com.lagradost.cloudstream3.metaproviders

import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.JsonNode
import com.lagradost.cloudstream3.Episode
import com.lagradost.cloudstream3.HomePageResponse
import com.lagradost.cloudstream3.LoadResponse
import com.lagradost.cloudstream3.LoadResponse.Companion.addImdbId
import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.MainPageRequest
import com.lagradost.cloudstream3.SearchResponse
import com.lagradost.cloudstream3.Score
import com.lagradost.cloudstream3.ShowStatus
import com.lagradost.cloudstream3.TvType
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.mapper
import com.lagradost.cloudstream3.mainPageOf
import com.lagradost.cloudstream3.newEpisode
import com.lagradost.cloudstream3.newHomePageResponse
import com.lagradost.cloudstream3.newMovieLoadResponse
import com.lagradost.cloudstream3.newMovieSearchResponse
import com.lagradost.cloudstream3.newTvSeriesLoadResponse
import com.lagradost.cloudstream3.newTvSeriesSearchResponse
import com.lagradost.cloudstream3.syncproviders.SyncIdName
import com.lagradost.cloudstream3.utils.extractorLog
import java.net.URLEncoder
import java.time.Instant

open class TraktProvider : MainAPI() {

    override var name: String = "Trakt"

    override var mainUrl: String = "https://v3-cinemeta.strem.io"

    override val supportedTypes: Set<TvType> = setOf(TvType.Movie, TvType.TvSeries, TvType.Anime)

    override val supportedSyncNames: Set<SyncIdName> = setOf(SyncIdName.Trakt)

    override val hasMainPage: Boolean = true

    override val hasQuickSearch: Boolean = true

    override val mainPage = mainPageOf(
        "movie/top" to "Trending Movies",
        "series/top" to "Trending Shows",
        "series/top/genre=Animation" to "Animation",
        "movie/top/genre=Documentary" to "Documentaries",
    )

    data class LinkData(
        @JsonProperty("id") val id: Int? = null,
        @JsonProperty("imdbId") val imdbId: String? = null,
        @JsonProperty("tmdbId") val tmdbId: Int? = null,
        @JsonProperty("tvdbId") val tvdbId: Int? = null,
        @JsonProperty("type") val type: String? = null,
        @JsonProperty("title") val title: String? = null,
        @JsonProperty("name") val name: String? = null,
        @JsonProperty("year") val year: Int? = null,
        @JsonProperty("season") val season: Int? = null,
        @JsonProperty("episode") val episode: Int? = null,
        @JsonProperty("is_anime") val isAnime: Boolean = false,
    )

    override suspend fun getMainPage(page: Int, request: MainPageRequest): HomePageResponse? {
        val metas = fetch(catalogUrl(request.data, page))?.path("metas") ?: return null
        val items = metas.mapNotNull(::searchResponseOf)
        return newHomePageResponse(request.name, items, items.size >= PAGE)
    }

    override suspend fun search(query: String): List<SearchResponse> {
        val term = query.trim()
        if (term.isEmpty()) return emptyList()
        val encoded = URLEncoder.encode(term, "UTF-8")
        val out = ArrayList<SearchResponse>()
        for (kind in listOf(MOVIE, SERIES)) {
            val metas = fetch("$mainUrl/catalog/$kind/top/search=$encoded.json")?.path("metas") ?: continue
            out.addAll(metas.mapNotNull(::searchResponseOf))
        }
        return out
    }

    override suspend fun load(url: String): LoadResponse? {
        val id = IMDB_ID.find(url)?.value ?: return null
        val kind = if (url.contains("/$MOVIE/")) MOVIE else SERIES
        val meta = fetch("$mainUrl/meta/$kind/$id.json")?.path("meta") ?: return null
        if (meta.isMissingNode) return null

        val title = meta.path("name").asText("").ifBlank { id }
        val year = yearOf(meta)
        val anime = isAnime(meta)
        val tags = meta.path("genre").mapNotNull { it.asText("").takeIf(String::isNotBlank) }
        val rating = Score.from(meta.path("imdbRating").asText("").toDoubleOrNull(), 10)
        val minutes = Regex("""\d+""").find(meta.path("runtime").asText(""))?.value?.toIntOrNull()

        val base = LinkData(
            id = meta.path("moviedb_id").asInt(0).takeIf { it > 0 },
            imdbId = id,
            tmdbId = meta.path("moviedb_id").asInt(0).takeIf { it > 0 },
            tvdbId = meta.path("tvdb_id").asInt(0).takeIf { it > 0 },
            type = kind,
            title = title,
            name = title,
            year = year,
            isAnime = anime,
        )

        if (kind == MOVIE) {
            return newMovieLoadResponse(title, url, TvType.Movie, handle(base)) {
                this.posterUrl = meta.path("poster").asText("").ifBlank { null }
                this.backgroundPosterUrl = meta.path("background").asText("").ifBlank { null }
                this.plot = meta.path("description").asText("").ifBlank { null }
                this.year = year
                this.tags = tags
                this.score = rating
                this.duration = minutes
                addImdbId(id)
            }
        }

        val episodes = meta.path("videos").mapNotNull { episodeOf(it, base) }
        return newTvSeriesLoadResponse(title, url, TvType.TvSeries, episodes) {
            this.posterUrl = meta.path("poster").asText("").ifBlank { null }
            this.backgroundPosterUrl = meta.path("background").asText("").ifBlank { null }
            this.plot = meta.path("description").asText("").ifBlank { null }
            this.year = year
            this.tags = tags
            this.score = rating
            this.duration = minutes
            this.showStatus = if (meta.path("status").asText("").equals("Continuing", true)) {
                ShowStatus.Ongoing
            } else {
                ShowStatus.Completed
            }
            addImdbId(id)
        }
    }

    private fun episodeOf(video: JsonNode, base: LinkData): Episode? {
        val season = video.path("season").asInt(-1)
        val number = video.path("episode").asInt(video.path("number").asInt(-1))
        if (season < 0 || number < 0) return null
        val data = handle(base.copy(season = season, episode = number))
        return newEpisode(data) {
            this.name = video.path("name").asText("").ifBlank { null }
            this.season = season
            this.episode = number
            this.posterUrl = video.path("thumbnail").asText("").ifBlank { null }
            this.description = video.path("overview").asText("").ifBlank { null }
            this.date = epochOf(video.path("released").asText("").ifBlank { video.path("firstAired").asText("") })
        }
    }

    private fun searchResponseOf(meta: JsonNode): SearchResponse? {
        val id = meta.path("imdb_id").asText("").ifBlank { meta.path("id").asText("") }
        if (!id.startsWith("tt")) return null
        val title = meta.path("name").asText("").ifBlank { return null }
        val kind = if (meta.path("type").asText("") == MOVIE) MOVIE else SERIES
        val url = "$mainUrl/meta/$kind/$id.json"
        val poster = meta.path("poster").asText("").ifBlank { null }
        return if (kind == MOVIE) {
            newMovieSearchResponse(title, url, TvType.Movie) {
                this.posterUrl = poster
                this.year = yearOf(meta)
            }
        } else {
            newTvSeriesSearchResponse(title, url, TvType.TvSeries) {
                this.posterUrl = poster
                this.year = yearOf(meta)
            }
        }
    }

    private fun yearOf(meta: JsonNode): Int? =
        Regex("""\d{4}""").find(meta.path("year").asText(""))?.value?.toIntOrNull()

    private fun isAnime(meta: JsonNode): Boolean {
        val animated = meta.path("genre").any { it.asText("").equals("Animation", true) }
        if (!animated) return false
        return meta.path("country").asText("").contains("Japan", true)
    }

    private fun catalogUrl(data: String, page: Int): String {
        val skip = (page - 1) * PAGE
        if (skip <= 0) return "$mainUrl/catalog/$data.json"
        val glue = if (data.contains('=')) "&" else "/"
        return "$mainUrl/catalog/$data${glue}skip=$skip.json"
    }

    private fun handle(data: LinkData): String = mapper.writeValueAsString(data)

    private fun epochOf(text: String): Long? =
        if (text.isBlank()) null else runCatching { Instant.parse(text).toEpochMilli() }.getOrNull()

    private suspend fun fetch(url: String): JsonNode? = try {
        val body = app.get(url).text
        if (body.isBlank()) null else mapper.readTree(body)
    } catch (t: Throwable) {
        extractorLog("$name request failed for $url: ${t.message}")
        null
    }

    private companion object {
        const val MOVIE = "movie"
        const val SERIES = "series"
        const val PAGE = 50
        val IMDB_ID = Regex("""tt\d{5,}""")
    }
}
