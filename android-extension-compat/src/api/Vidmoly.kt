package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink

open class Vidmoly : EmbedPlayerExtractor("Vidmoly", "https://vidmoly.to") {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        var produced = 0
        val counted: (ExtractorLink) -> Unit = {
            produced++
            callback(it)
        }
        for (candidate in candidates(url)) {
            super.getUrl(candidate, referer, subtitleCallback, counted)
            if (produced > 0) return
        }
    }

    override fun prepare(url: String): String {
        if (url.contains("embed-")) return url
        val id = embedFileId(url) ?: return url
        return "${hostRoot(url, mainUrl)}/embed-$id.html"
    }

    private fun candidates(url: String): List<String> {
        val id = embedFileId(url) ?: return listOf(url)
        val here = hostRoot(url, mainUrl)
        return listOf(url) + SERVING.filter { it != here }.map { "$it/embed-$id.html" }
    }

    private companion object {
        val SERVING = listOf("https://vidmoly.biz")
    }
}

class VidmolyBiz : Vidmoly() {
    override val name = "Vidmoly"
    override val mainUrl = "https://vidmoly.biz"
}
