package com.harbor.capstan

/** The host facing shape of everything an extension can produce.
 *
 * Nothing here names a compat type, so a caller can consume the result of a scrape without
 * linking against the layer the extension was compiled for. */

data class ProviderInfo(
    val name: String,
    val mainUrl: String,
    val lang: String,
    val supportedTypes: List<String>,
    val hasMainPage: Boolean,
    val hasQuickSearch: Boolean,
    val hasDownloadSupport: Boolean,
    val instantLinkLoading: Boolean,
)

data class SearchItem(
    val name: String,
    val url: String,
    val apiName: String,
    val type: String?,
    val posterUrl: String?,
    val posterHeaders: Map<String, String>,
    val quality: String?,
    val scoreOutOf10: Double?,
)

data class EpisodeItem(
    val data: String,
    val name: String?,
    val season: Int?,
    val episode: Int?,
    val posterUrl: String?,
    val description: String?,
    val runtimeMinutes: Int?,
    val airDate: Long?,
    /** Empty for anything that is not split by audio track. */
    val track: String,
)

data class MediaItem(
    val name: String,
    val url: String,
    val apiName: String,
    val type: String,
    val posterUrl: String?,
    val backgroundPosterUrl: String?,
    val year: Int?,
    val plot: String?,
    val tags: List<String>,
    val durationMinutes: Int?,
    val contentRating: String?,
    val scoreOutOf10: Double?,
    val comingSoon: Boolean,
    /** Set for a single playable item. An item with episodes carries its data per episode. */
    val playableData: String?,
    val episodes: List<EpisodeItem>,
    val recommendations: List<SearchItem>,
    val actors: List<String>,
    val trailerUrls: List<String>,
    val syncIds: Map<String, String>,
)

data class StreamLink(
    val source: String,
    val name: String,
    val url: String,
    val referer: String,
    val quality: Int,
    val type: String,
    val headers: Map<String, String>,
)

data class SubtitleItem(
    val lang: String,
    val url: String,
    val headers: Map<String, String>,
)

data class LinkSet(
    /** What the provider itself reported, which is not the same as having produced links. */
    val handled: Boolean,
    val links: List<StreamLink>,
    val subtitles: List<SubtitleItem>,
)
