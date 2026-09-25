package com.lagradost.cloudstream3.syncproviders.providers

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/** Shapes of the AniList GraphQL payloads that extensions embed in their own response models.
 * Every field is optional because an extension asks for whatever subset of the schema it needs,
 * and unknown keys are ignored so a wider query still parses. */
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
        val node: RecommendationNode? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class RecommendationNode(
        val id: Int? = null,
        val mediaRecommendation: RecommendationMedia? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class RecommendationMedia(
        val id: Int? = null,
        val title: Title? = null,
        val coverImage: CoverImage? = null,
    )
}
