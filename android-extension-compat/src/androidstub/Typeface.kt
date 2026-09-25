package android.graphics

open class Typeface(val family: String?, private val styleFlags: Int) {

    fun getStyle(): Int = styleFlags

    fun isBold(): Boolean = (styleFlags and BOLD) != 0

    fun isItalic(): Boolean = (styleFlags and ITALIC) != 0

    override fun toString(): String = "Typeface{${family ?: "default"}, $styleFlags}"

    companion object {
        const val NORMAL: Int = 0
        const val BOLD: Int = 1
        const val ITALIC: Int = 2
        const val BOLD_ITALIC: Int = 3

        @JvmField val DEFAULT: Typeface = Typeface("sans-serif", NORMAL)
        @JvmField val DEFAULT_BOLD: Typeface = Typeface("sans-serif", BOLD)
        @JvmField val SANS_SERIF: Typeface = Typeface("sans-serif", NORMAL)
        @JvmField val SERIF: Typeface = Typeface("serif", NORMAL)
        @JvmField val MONOSPACE: Typeface = Typeface("monospace", NORMAL)

        @JvmStatic
        fun create(familyName: String?, style: Int): Typeface = Typeface(familyName, style)

        @JvmStatic
        fun create(family: Typeface?, style: Int): Typeface =
            Typeface(family?.family ?: "sans-serif", style)

        @JvmStatic
        fun defaultFromStyle(style: Int): Typeface = when (style) {
            BOLD -> DEFAULT_BOLD
            else -> Typeface("sans-serif", style)
        }
    }
}
