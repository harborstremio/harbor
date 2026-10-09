package com.lagradost.cloudstream3.utils

object DataStoreHelper {

    class ResumeWatchingResult(
        val id: Int? = null,
        val parentId: Int? = null,
        val name: String = "",
        val url: String = "",
        val apiName: String = "",
        val season: Int? = null,
        val episode: Int? = null,
        val isFromDownload: Boolean = false,
    ) {
        override fun toString(): String = "ResumeWatchingResult($name, $id, parent $parentId)"
    }
}
