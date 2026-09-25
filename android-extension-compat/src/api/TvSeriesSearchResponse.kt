package com.lagradost.cloudstream3

/** The search result a series lookup returns. It carries the same fields as a movie one, and
 * extensions set poster and quality on it through the shared SearchResponse surface, so it is a
 * separate type only because a build that asks for a series result names it by name. */
class TvSeriesSearchResponse(
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
}
