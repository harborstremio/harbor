package android.webkit

object URLUtil {

    @JvmStatic
    fun isValidUrl(url: String?): Boolean {
        val trimmed = url?.trim().orEmpty()
        if (trimmed.isEmpty()) return false
        return SCHEMES.any { trimmed.regionMatches(0, it, 0, it.length, ignoreCase = true) }
    }

    @JvmStatic
    fun isNetworkUrl(url: String?): Boolean {
        val trimmed = url?.trim().orEmpty()
        return trimmed.startsWith("http://", true) || trimmed.startsWith("https://", true)
    }

    @JvmStatic
    fun guessFileName(url: String?, contentDisposition: String?, mimeType: String?): String {
        val name = url?.substringBefore('?')?.substringBefore('#')?.trimEnd('/')
            ?.substringAfterLast('/').orEmpty()
        return name.ifEmpty { "downloadfile" }
    }

    private val SCHEMES = listOf(
        "http://",
        "https://",
        "file://",
        "content://",
        "data:",
        "javascript:",
        "about:",
    )
}
