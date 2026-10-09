package com.lagradost.cloudstream3

data class TrailerData(
    val extractorUrl: String,
    val referer: String? = null,
    val raw: Boolean = false,
    val headers: Map<String, String> = emptyMap(),
)

interface LoadResponse {
    var name: String
    var url: String
    var apiName: String
    var type: TvType
    var posterUrl: String?
    var posterHeaders: Map<String, String>?
    var backgroundPosterUrl: String?
    var logoUrl: String?
    var year: Int?
    var plot: String?
    var score: Score?
    var tags: List<String>?
    var duration: Int?
    var contentRating: String?
    var comingSoon: Boolean
    var trailers: MutableList<TrailerData>
    var recommendations: List<SearchResponse>?
    var actors: List<ActorData>?
    var syncData: MutableMap<String, String>

    companion object {
        const val MAL_ID = "malId"
        const val ANILIST_ID = "aniListId"
        const val TMDB_ID = "tmdbId"
        const val IMDB_ID = "imdbId"
        const val SIMKL_ID = "simklId"
        const val KITSU_ID = "kitsuId"

        fun LoadResponse.addActorsRole(actors: List<*>?) {
            if (actors.isNullOrEmpty()) return
            this.actors = actors.mapNotNull(::readActor)
        }

        fun LoadResponse.addActors(actors: List<*>?) {
            if (actors.isNullOrEmpty()) return
            this.actors = actors.mapNotNull(::readActor)
        }

        fun LoadResponse.addActorNames(actors: List<*>?) {
            if (actors.isNullOrEmpty()) return
            this.actors = actors.mapNotNull(::readActor)
        }

        fun LoadResponse.addActorsOnly(actors: List<*>?) {
            if (actors.isNullOrEmpty()) return
            this.actors = actors.mapNotNull(::readActor)
        }

        fun LoadResponse.addMalId(id: Int?) {
            this.syncData[MAL_ID] = (id ?: return).toString()
        }

        fun LoadResponse.addAniListId(id: Int?) {
            this.syncData[ANILIST_ID] = (id ?: return).toString()
        }

        fun LoadResponse.addTMDbId(id: String?) {
            this.syncData[TMDB_ID] = id ?: return
        }

        fun LoadResponse.addImdbId(id: String?) {
            this.syncData[IMDB_ID] = id ?: return
        }

        fun LoadResponse.addImdbUrl(url: String?) {
            addImdbId(url?.let { IMDB_ID_IN_URL.find(it)?.value })
        }

        fun LoadResponse.addSimklId(id: Int?) {
            this.syncData[SIMKL_ID] = (id ?: return).toString()
        }

        fun LoadResponse.addKitsuId(id: String?) {
            this.syncData[KITSU_ID] = id ?: return
        }

        fun LoadResponse.addScore(score: String?, maxValue: Int = 10) {
            this.score = Score.from(score, maxValue) ?: return
        }

        fun LoadResponse.addDuration(durationText: String?) {
            this.duration = getDurationFromString(durationText) ?: return
        }

        suspend fun LoadResponse.addTrailer(
            trailerUrl: String?,
            referer: String? = null,
            addRequestHeader: Boolean = false,
        ) {
            val url = trailerUrl?.trim().orEmpty()
            if (url.isEmpty()) return
            if (trailers.any { it.extractorUrl == url }) return
            val headers = if (addRequestHeader && referer != null) mapOf("referer" to referer) else emptyMap()
            trailers.add(TrailerData(url, referer, false, headers))
        }

        suspend fun LoadResponse.addTrailer(
            trailerUrls: List<String>?,
            referer: String? = null,
            addRequestHeader: Boolean = false,
        ) {
            trailerUrls?.forEach { addTrailer(it, referer, addRequestHeader) }
        }
    }
}

private fun readActor(value: Any?): ActorData? = when (value) {
    is ActorData -> value
    is Actor -> ActorData(value)
    is String -> ActorData(Actor(value))
    is Pair<*, *> -> (value.first as? Actor)?.let { actor ->
        when (val role = value.second) {
            is ActorRole -> ActorData(actor, role = role)
            is String -> ActorData(actor, roleString = role)
            else -> ActorData(actor)
        }
    }
    else -> null
}

private val IMDB_ID_IN_URL = Regex("""tt\d{5,}""", RegexOption.IGNORE_CASE)
