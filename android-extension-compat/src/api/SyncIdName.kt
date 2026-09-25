package com.lagradost.cloudstream3.syncproviders

/** The catalogues a provider can resolve an id against. Extensions declare which ones they
 * support and are handed one back when the host asks them for a url. */
enum class SyncIdName {
    Anilist,
    MyAnimeList,
}
