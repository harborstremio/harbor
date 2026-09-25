package com.fleeksoft.ksoup

import com.fleeksoft.ksoup.nodes.Document
import org.jsoup.Jsoup

/** The entry point extensions call. The base uri default is load bearing: the compiler emits the
 * bridge the already compiled call sites use from it. */
object Ksoup {

    fun parse(html: String, baseUri: String = ""): Document = Document(Jsoup.parse(html, baseUri))

    fun parseBodyFragment(html: String, baseUri: String = ""): Document =
        Document(Jsoup.parseBodyFragment(html, baseUri))
}
