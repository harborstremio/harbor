package com.lagradost.cloudstream3

class AnimeSearchResponse(
    override var name: String,
    override var url: String,
    override var apiName: String,
    override var type: TvType? = null,
) : SearchResponse {
    override var posterUrl: String? = null
    override var posterHeaders: Map<String, String>? = null
    override var id: Int? = null
    override var quality: SearchQuality? = null
    override var score: Score? = null
    var year: Int? = null
    var otherName: String? = null
    var dubStatus: MutableSet<DubStatus>? = null
    var dubEpisodes: Int? = null
    var subEpisodes: Int? = null
}
