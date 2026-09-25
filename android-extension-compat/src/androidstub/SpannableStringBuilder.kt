package android.text

/** Built by the donation dialogs and then cast straight to CharSequence before it reaches a
 *  text view, so implementing CharSequence is part of the contract, not a convenience. */
open class SpannableStringBuilder() : CharSequence {

    class Span(val what: Any?, val start: Int, val end: Int, val flags: Int)

    private val buffer = StringBuilder()
    private val marks = ArrayList<Span>()

    constructor(source: CharSequence?) : this() {
        if (source != null) buffer.append(source)
    }

    override val length: Int
        get() = buffer.length

    /** Out of range reads give a space rather than an exception: a malformed span must not take
     *  down the screen that is rendering it. */
    override fun get(index: Int): Char =
        if (index >= 0 && index < buffer.length) buffer[index] else ' '

    override fun subSequence(startIndex: Int, endIndex: Int): CharSequence {
        val from = startIndex.coerceIn(0, buffer.length)
        val to = endIndex.coerceIn(from, buffer.length)
        return buffer.substring(from, to)
    }

    fun append(text: CharSequence?): SpannableStringBuilder {
        if (text != null) buffer.append(text)
        return this
    }

    fun append(text: CharSequence?, what: Any?, flags: Int): SpannableStringBuilder {
        val start = buffer.length
        append(text)
        setSpan(what, start, buffer.length, flags)
        return this
    }

    fun insert(where: Int, text: CharSequence?): SpannableStringBuilder {
        if (text != null) buffer.insert(where.coerceIn(0, buffer.length), text)
        return this
    }

    fun clear() {
        buffer.setLength(0)
        marks.clear()
    }

    fun setSpan(what: Any?, start: Int, end: Int, flags: Int) {
        val from = start.coerceIn(0, buffer.length)
        val to = end.coerceIn(from, buffer.length)
        marks.add(Span(what, from, to, flags))
    }

    fun removeSpan(what: Any?) {
        marks.removeAll { it.what === what }
    }

    fun getSpanStart(what: Any?): Int = marks.firstOrNull { it.what === what }?.start ?: -1

    fun getSpanEnd(what: Any?): Int = marks.firstOrNull { it.what === what }?.end ?: -1

    fun getSpanFlags(what: Any?): Int = marks.firstOrNull { it.what === what }?.flags ?: 0

    fun getSpans(): List<Span> = marks

    override fun toString(): String = buffer.toString()

    companion object {
        const val SPAN_INCLUSIVE_EXCLUSIVE: Int = 0x22
        const val SPAN_EXCLUSIVE_EXCLUSIVE: Int = 0x21
        const val SPAN_INCLUSIVE_INCLUSIVE: Int = 0x12
        const val SPAN_EXCLUSIVE_INCLUSIVE: Int = 0x11
    }
}
