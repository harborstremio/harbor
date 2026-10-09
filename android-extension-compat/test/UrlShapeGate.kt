package harbor.capstan.test

import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.TvType
import com.lagradost.cloudstream3.fixUrl
import com.lagradost.cloudstream3.newEpisode
import com.lagradost.cloudstream3.newMovieSearchResponse

private class Probe(override var mainUrl: String) : MainAPI() {
    override var name = "Probe"
    override val supportedTypes = setOf(TvType.Movie)
}

private class Handle(val id: Int, val kind: String)

private val failures = ArrayList<String>()

private fun check(label: String, got: String, want: String) {
    if (got == want) println("  ok   $label") else {
        println("  FAIL $label")
        println("         got  $got")
        println("         want $want")
        failures.add(label)
    }
}

private fun site() = Probe("https://site.test")

fun main() {
    println("=== fixUrl, a provider with a mainUrl")
    val s = site()
    check("a site relative path resolves", s.fixUrl("/episode/x-1x1/"), "https://site.test/episode/x-1x1/")
    check("a bare token resolves", s.fixUrl("anikoto|55|1|sub"), "https://site.test/anikoto|55|1|sub")
    check("a path with no slash resolves", s.fixUrl("watch/x"), "https://site.test/watch/x")
    check("an absolute url is left alone", s.fixUrl("https://other.test/x"), "https://other.test/x")
    check("a protocol relative url gains https", s.fixUrl("//cdn.test/x"), "https://cdn.test/x")
    check("empty stays empty", s.fixUrl(""), "")
    check("a json object is left whole", s.fixUrl("""{"id":550,"type":"movie"}"""), """{"id":550,"type":"movie"}""")
    check("a json array is left whole", s.fixUrl("""[{"id":1}]"""), """[{"id":1}]""")
    check("leading space before json still counts", s.fixUrl(""" {"id":1}"""), """ {"id":1}""")

    println("=== fixUrl, a provider whose mainUrl is not configured")
    val blank = Probe("")
    check("a json object survives an empty mainUrl", blank.fixUrl("""{"id":550}"""), """{"id":550}""")
    check("a path still resolves against an empty mainUrl", blank.fixUrl("/manifest.json"), "/manifest.json")

    println("=== newEpisode")
    check("a relative episode path resolves", s.newEpisode("/episode/x-1x2/").data, "https://site.test/episode/x-1x2/")
    check("a bare token resolves", s.newEpisode("anikoto|55|2|sub").data, "https://site.test/anikoto|55|2|sub")
    check("a json string is left whole", s.newEpisode("""{"id":4061,"box_type":1}""").data, """{"id":4061,"box_type":1}""")
    check("an absolute url is left alone", s.newEpisode("https://other.test/ep/1").data, "https://other.test/ep/1")
    check("an object is serialized and left alone", s.newEpisode(Handle(7, "sub")).data, """{"id":7,"kind":"sub"}""")
    check("null becomes empty", s.newEpisode(null).data, "")

    println("=== newMovieSearchResponse")
    check(
        "a json handle survives the search builder",
        s.newMovieSearchResponse("Fight Club", """{"id":550,"type":"movie"}""").url,
        """{"id":550,"type":"movie"}""",
    )
    check(
        "fix=false still opts out",
        s.newMovieSearchResponse("Fight Club", "/movies/x", fix = false).url,
        "/movies/x",
    )
    check(
        "a relative result url resolves",
        s.newMovieSearchResponse("Fight Club", "/movies/x").url,
        "https://site.test/movies/x",
    )

    println()
    if (failures.isEmpty()) {
        println("URL SHAPE GATE ok")
    } else {
        println("URL SHAPE GATE ${failures.size} failed: ${failures.joinToString(", ")}")
        kotlin.system.exitProcess(1)
    }
}
