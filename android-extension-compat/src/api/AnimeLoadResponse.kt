package com.lagradost.cloudstream3

class AnimeLoadResponse(
    override var name: String,
    override var url: String,
    override var apiName: String,
    override var type: TvType,
) : LoadResponse {
    var engName: String? = null
    var japName: String? = null
    var showStatus: ShowStatus? = null
    var episodes: MutableMap<DubStatus, List<Episode>> = mutableMapOf()
    var nextAiring: Int? = null
    override var posterUrl: String? = null
    override var posterHeaders: Map<String, String>? = null
    override var backgroundPosterUrl: String? = null
    override var logoUrl: String? = null
    override var year: Int? = null
    override var plot: String? = null
    override var score: Score? = null
    override var tags: List<String>? = null
    override var duration: Int? = null
    override var contentRating: String? = null
    override var comingSoon: Boolean = false
    override var trailers: MutableList<TrailerData> = mutableListOf()
    override var recommendations: List<SearchResponse>? = null
    override var actors: List<ActorData>? = null
    override var syncData: MutableMap<String, String> = mutableMapOf()
}
