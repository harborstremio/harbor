package android.content.res

import android.util.AttributeSet
import org.xmlpull.v1.XmlPullParser

/** Stands in for a compiled layout. The host has no resource table, so every instance reports an
 * empty document rather than failing: an inflater walking it produces an empty view and the
 * extension carries on. */
open class XmlResourceParser : XmlPullParser, AttributeSet {

    open fun getEventType(): Int = END_DOCUMENT

    open fun next(): Int = END_DOCUMENT

    open fun nextTag(): Int = END_DOCUMENT

    open fun nextText(): String = ""

    open fun getName(): String? = null

    open fun getText(): String? = null

    open fun getNamespace(): String? = null

    open fun getDepth(): Int = 0

    open fun getLineNumber(): Int = 0

    open fun getColumnNumber(): Int = 0

    open fun isEmptyElementTag(): Boolean = true

    open fun close() {}

    override fun getAttributeCount(): Int = 0

    override fun getAttributeName(index: Int): String? = null

    override fun getAttributeValue(index: Int): String? = null

    override fun getAttributeValue(namespace: String?, name: String?): String? = null

    override fun getAttributeIntValue(namespace: String?, name: String?, defaultValue: Int): Int = defaultValue

    override fun getAttributeBooleanValue(namespace: String?, name: String?, defaultValue: Boolean): Boolean =
        defaultValue

    override fun getPositionDescription(): String = "empty layout"

    companion object {
        const val START_DOCUMENT: Int = 0
        const val END_DOCUMENT: Int = 1
        const val START_TAG: Int = 2
        const val END_TAG: Int = 3
        const val TEXT: Int = 4
    }
}
