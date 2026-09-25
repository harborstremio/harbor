package com.lagradost.nicehttp

object RequestBodyTypes {
    const val JSON = "application/json;charset=utf-8"
    const val TEXT = "text/plain;charset=utf-8"
}

val DEFAULT_USER_AGENT: String =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"

val DEFAULT_HEADERS: Map<String, String> = mapOf(
    "user-agent" to DEFAULT_USER_AGENT,
    "accept" to "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language" to "en-US,en;q=0.9"
)
