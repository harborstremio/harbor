package com.lagradost.cloudstream3

import com.lagradost.cloudstream3.plugins.PluginManager
import com.lagradost.cloudstream3.utils.AtomicMutableList
import java.net.URI
import java.util.Locale

object APIHolder {

    fun String.capitalize(): String =
        replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }

    val unixTime: Long get() = System.currentTimeMillis() / 1000L

    val unixTimeMS: Long get() = System.currentTimeMillis()

    val allProviders: AtomicMutableList<MainAPI>
        get() = AtomicMutableList(PluginManager.plugins.values.flatMap { it.mainApis })

    suspend fun getCaptchaToken(url: String, key: String, referer: String? = null): String? = try {
        val origin = URI(url)
        val domain = base64Encode("${origin.scheme}://${origin.host}:443".toByteArray())
        val release = app.get("$CAPTCHA/api.js?render=$key", referer = referer)
            .text.substringAfter("releases/", "").substringBefore("/recaptcha")
        if (release.isEmpty()) {
            null
        } else {
            val anchor = app.get(
                "$CAPTCHA/api2/anchor?ar=1&hl=en&size=invisible&cb=123456789" +
                    "&k=$key&co=$domain&v=$release",
            ).document.selectFirst("#recaptcha-token")?.attr("value").orEmpty()
            if (anchor.isEmpty()) {
                null
            } else {
                val reloaded = app.post(
                    "$CAPTCHA/api2/reload?k=$key",
                    data = mapOf(
                        "v" to release,
                        "k" to key,
                        "c" to anchor,
                        "co" to domain,
                        "sa" to "",
                        "reason" to "q",
                    ),
                    referer = "$CAPTCHA/api2/",
                ).text
                RESPONSE.find(reloaded)?.groupValues?.getOrNull(1)
            }
        }
    } catch (t: Throwable) {
        null
    }

    private const val CAPTCHA = "https://www.google.com/recaptcha"

    private val RESPONSE = Regex("""\"rresp\",\"(.+?)\"""")
}
