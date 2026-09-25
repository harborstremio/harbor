package com.fleeksoft.ksoup.nodes

import com.fleeksoft.ksoup.select.Elements
import org.jsoup.nodes.Document as SourceDocument
import org.jsoup.nodes.Element as SourceElement

/** The document model extensions link against, over the parser already on the host.
 *
 * This is a facade and not a second parser: every query below is answered by the same engine the
 * rest of the layer scrapes with, so an extension written against either name sees one behaviour. */
open class Element internal constructor(internal val source: SourceElement) {

    fun attr(name: String): String = source.attr(name)

    fun hasAttr(name: String): Boolean = source.hasAttr(name)

    fun text(): String = source.text()

    fun ownText(): String = source.ownText()

    fun html(): String = source.html()

    fun outerHtml(): String = source.outerHtml()

    fun tagName(): String = source.tagName()

    fun id(): String = source.id()

    fun className(): String = source.className()

    fun hasClass(name: String): Boolean = source.hasClass(name)

    fun select(query: String): Elements = Elements(source.select(query))

    fun selectFirst(query: String): Element? = source.selectFirst(query)?.let(::wrapNode)

    fun children(): Elements = Elements(source.children())

    fun parent(): Element? = source.parent()?.let(::wrapNode)

    fun nextElementSibling(): Element? = source.nextElementSibling()?.let(::wrapNode)

    override fun toString(): String = source.outerHtml()
}

class Document internal constructor(private val document: SourceDocument) : Element(document) {

    fun title(): String = document.title()

    fun body(): Element? = document.body()?.let(::wrapNode)

    fun head(): Element? = document.head()?.let(::wrapNode)

    fun location(): String = document.location()
}

internal fun wrapNode(node: SourceElement): Element =
    if (node is SourceDocument) Document(node) else Element(node)
