package com.lagradost.cloudstream3

class SubtitleFile(
    var lang: String,
    var url: String,
    var headers: Map<String, String> = emptyMap(),
) {
    override fun toString(): String = "SubtitleFile($lang, $url)"
}
