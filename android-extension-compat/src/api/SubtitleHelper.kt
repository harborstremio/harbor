package com.lagradost.cloudstream3.utils

import java.util.Locale

object SubtitleHelper {

    private val extra = mapOf(
        "in" to "Indonesian",
        "id" to "Indonesian",
        "iw" to "Hebrew",
        "he" to "Hebrew",
        "ji" to "Yiddish",
        "jw" to "Javanese",
        "fil" to "Filipino",
        "tl" to "Filipino",
        "zh-hans" to "Chinese Simplified",
        "zh-hant" to "Chinese Traditional",
        "zh-cn" to "Chinese Simplified",
        "zh-tw" to "Chinese Traditional",
        "pt-br" to "Brazilian Portuguese",
        "es-la" to "Latin American Spanish",
        "es-419" to "Latin American Spanish",
    )

    private val byEnglishName: Map<String, String> by lazy {
        Locale.getISOLanguages().associateBy(
            { Locale(it).getDisplayLanguage(Locale.ENGLISH).lowercase() },
            { it },
        )
    }

    fun fromTagToEnglishLanguageName(tag: String): String? {
        val clean = tag.trim().replace('_', '-')
        if (clean.isEmpty()) return null
        extra[clean.lowercase()]?.let { return it }

        val display = Locale.forLanguageTag(clean).getDisplayLanguage(Locale.ENGLISH)
        if (display.isNotEmpty() && !display.equals(clean, ignoreCase = true)) {
            val region = Locale.forLanguageTag(clean).getDisplayCountry(Locale.ENGLISH)
            return if (region.isEmpty()) display else "$display ($region)"
        }

        val primary = clean.substringBefore('-').lowercase()
        extra[primary]?.let { return it }
        val fallback = Locale(primary).getDisplayLanguage(Locale.ENGLISH)
        return if (fallback.isNotEmpty() && !fallback.equals(primary, ignoreCase = true)) fallback else null
    }

    fun fromEnglishLanguageNameToTag(name: String): String? = byEnglishName[name.trim().lowercase()]
}
