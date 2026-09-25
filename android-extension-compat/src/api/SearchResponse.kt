package com.lagradost.cloudstream3

interface SearchResponse {
    var name: String
    var url: String
    var apiName: String
    var type: TvType?
    var posterUrl: String?
    var posterHeaders: Map<String, String>?
    var id: Int?
    var quality: SearchQuality?
    var score: Score?
}

class SearchResponseList(
    val items: List<SearchResponse>,
    val hasNext: Boolean? = null,
)
