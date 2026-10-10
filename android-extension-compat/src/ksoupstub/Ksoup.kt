package com.fleeksoft.ksoup

import com.fleeksoft.ksoup.nodes.Document
import org.jsoup.Jsoup

object Ksoup {

    fun parse(html: String, baseUri: String = ""): Document = Document(Jsoup.parse(html, baseUri))

    fun parseBodyFragment(html: String, baseUri: String = ""): Document =
        Document(Jsoup.parseBodyFragment(html, baseUri))
}
