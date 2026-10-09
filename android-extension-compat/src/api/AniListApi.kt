package com.lagradost.cloudstream3.syncproviders.providers

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

class AniListApi {
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Title(
        val romaji: String? = null,
        val english: String? = null,
        val `native`: String? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class CoverImage(
        val extraLarge: String? = null,
        val large: String? = null,
        val medium: String? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class MediaTitle(
        val romaji: String? = null,
        val english: String? = null,
        val `native`: String? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class MediaCoverImage(
        val large: String? = null,
        val medium: String? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class SeasonNextAiringEpisode(
        val episode: Int? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class LikePageInfo(
        val total: Int? = null,
        val perPage: Int? = null,
        val currentPage: Int? = null,
        val lastPage: Int? = null,
        val hasNextPage: Boolean? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class RecommendationConnection(
        val edges: List<RecommendationEdge>? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class RecommendationEdge(
        val node: Recommendation? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Recommendation(
        val id: Int? = null,
        val mediaRecommendation: RecommendedMedia? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class RecommendedMedia(
        val id: Int? = null,
        val title: MediaTitle? = null,
        val coverImage: MediaCoverImage? = null,
    )
}
