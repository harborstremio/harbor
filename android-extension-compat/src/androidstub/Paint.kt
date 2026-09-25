package android.graphics

/** Stroke and fill state. Extensions build two of these per custom drawable and read nothing
 *  back, so every setter stores a value a renderer can later act on. */
open class Paint(initialFlags: Int = 0) {

    enum class Style { FILL, STROKE, FILL_AND_STROKE }

    enum class Join { MITER, ROUND, BEVEL }

    enum class Cap { BUTT, ROUND, SQUARE }

    enum class Align { LEFT, CENTER, RIGHT }

    var flags: Int = initialFlags

    var isAntiAlias: Boolean = (initialFlags and ANTI_ALIAS_FLAG) != 0

    var isDither: Boolean = (initialFlags and DITHER_FLAG) != 0

    var color: Int = Color.BLACK

    var style: Style? = Style.FILL

    var strokeWidth: Float = 0f

    var strokeJoin: Join? = Join.MITER

    var strokeCap: Cap? = Cap.BUTT

    var strokeMiter: Float = 4f

    var textSize: Float = 12f

    var textAlign: Align? = Align.LEFT

    var typeface: Typeface? = null

    private var filter: ColorFilter? = null

    /** Android folds alpha into the packed colour rather than keeping it beside it. */
    fun setAlpha(alpha: Int) {
        val a = alpha.coerceIn(0, 255)
        color = (color and 0x00FFFFFF) or (a shl 24)
    }

    fun getAlpha(): Int = color ushr 24

    fun setColorFilter(colorFilter: ColorFilter?): ColorFilter? {
        filter = colorFilter
        return colorFilter
    }

    fun getColorFilter(): ColorFilter? = filter

    fun set(source: Paint?) {
        if (source == null) return
        flags = source.flags
        isAntiAlias = source.isAntiAlias
        isDither = source.isDither
        color = source.color
        style = source.style
        strokeWidth = source.strokeWidth
        strokeJoin = source.strokeJoin
        strokeCap = source.strokeCap
        strokeMiter = source.strokeMiter
        textSize = source.textSize
        textAlign = source.textAlign
        typeface = source.typeface
        filter = source.filter
    }

    fun reset() {
        flags = 0
        isAntiAlias = false
        isDither = false
        color = Color.BLACK
        style = Style.FILL
        strokeWidth = 0f
        strokeJoin = Join.MITER
        strokeCap = Cap.BUTT
        strokeMiter = 4f
        textSize = 12f
        textAlign = Align.LEFT
        typeface = null
        filter = null
    }

    fun measureText(text: String?): Float = (text?.length ?: 0) * textSize * 0.5f

    companion object {
        const val ANTI_ALIAS_FLAG: Int = 0x01
        const val FILTER_BITMAP_FLAG: Int = 0x02
        const val DITHER_FLAG: Int = 0x04
        const val UNDERLINE_TEXT_FLAG: Int = 0x08
        const val STRIKE_THRU_TEXT_FLAG: Int = 0x10
        const val FAKE_BOLD_TEXT_FLAG: Int = 0x20
        const val LINEAR_TEXT_FLAG: Int = 0x40
        const val SUBPIXEL_TEXT_FLAG: Int = 0x80
    }
}
