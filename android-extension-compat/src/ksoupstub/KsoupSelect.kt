package com.fleeksoft.ksoup.select

import com.fleeksoft.ksoup.nodes.Element
import com.fleeksoft.ksoup.nodes.wrapNode
import org.jsoup.nodes.Element as SourceElement

/** A selection result. It is a list because extension code iterates it directly, which means the
 * loop in the already compiled bytecode is a plain list iteration and has to keep working. */
class Elements internal constructor(nodes: List<SourceElement>) :
    ArrayList<Element>(nodes.map(::wrapNode)) {

    fun attr(name: String): String = firstOrNull { it.hasAttr(name) }?.attr(name) ?: ""

    fun eachAttr(name: String): List<String> = filter { it.hasAttr(name) }.map { it.attr(name) }

    fun text(): String = joinToString(" ") { it.text() }

    fun eachText(): List<String> = map { it.text() }

    fun html(): String = joinToString("\n") { it.html() }

    fun outerHtml(): String = joinToString("\n") { it.outerHtml() }

    fun first(): Element? = firstOrNull()

    fun last(): Element? = lastOrNull()

    fun select(query: String): Elements =
        Elements(flatMap { element -> element.select(query).map { it.source } })
}
