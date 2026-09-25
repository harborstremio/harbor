package android.graphics

/** Colour packing and the string parser extensions use for every hex literal they ship. */
open class Color {

    companion object {
        @JvmField val TRANSPARENT: Int = 0
        @JvmField val BLACK: Int = 0xFF000000.toInt()
        @JvmField val DKGRAY: Int = 0xFF444444.toInt()
        @JvmField val GRAY: Int = 0xFF888888.toInt()
        @JvmField val LTGRAY: Int = 0xFFCCCCCC.toInt()
        @JvmField val WHITE: Int = 0xFFFFFFFF.toInt()
        @JvmField val RED: Int = 0xFFFF0000.toInt()
        @JvmField val GREEN: Int = 0xFF00FF00.toInt()
        @JvmField val BLUE: Int = 0xFF0000FF.toInt()
        @JvmField val YELLOW: Int = 0xFFFFFF00.toInt()
        @JvmField val CYAN: Int = 0xFF00FFFF.toInt()
        @JvmField val MAGENTA: Int = 0xFFFF00FF.toInt()

        private val NAMED: Map<String, Int> = mapOf(
            "black" to BLACK,
            "darkgray" to DKGRAY,
            "darkgrey" to DKGRAY,
            "gray" to GRAY,
            "grey" to GRAY,
            "lightgray" to LTGRAY,
            "lightgrey" to LTGRAY,
            "white" to WHITE,
            "red" to RED,
            "green" to GREEN,
            "blue" to BLUE,
            "yellow" to YELLOW,
            "cyan" to CYAN,
            "magenta" to MAGENTA,
            "aqua" to CYAN,
            "fuchsia" to MAGENTA,
            "lime" to GREEN,
            "maroon" to 0xFF800000.toInt(),
            "navy" to 0xFF000080.toInt(),
            "olive" to 0xFF808000.toInt(),
            "purple" to 0xFF800080.toInt(),
            "silver" to 0xFFC0C0C0.toInt(),
            "teal" to 0xFF008080.toInt(),
        )

        /** Unparseable input yields opaque black rather than an exception, so one bad literal
         *  tints a widget instead of killing the scraping path that built it. */
        @JvmStatic
        fun parseColor(colorString: String?): Int {
            val s = colorString?.trim() ?: return BLACK
            if (s.startsWith("#")) {
                val hex = s.substring(1)
                val value = hex.toLongOrNull(16) ?: return BLACK
                return when (hex.length) {
                    6 -> (value or 0xFF000000L).toInt()
                    8 -> value.toInt()
                    else -> BLACK
                }
            }
            return NAMED[s.lowercase()] ?: BLACK
        }

        @JvmStatic fun alpha(color: Int): Int = color ushr 24
        @JvmStatic fun red(color: Int): Int = (color shr 16) and 0xFF
        @JvmStatic fun green(color: Int): Int = (color shr 8) and 0xFF
        @JvmStatic fun blue(color: Int): Int = color and 0xFF

        @JvmStatic
        fun rgb(red: Int, green: Int, blue: Int): Int = argb(0xFF, red, green, blue)

        @JvmStatic
        fun argb(alpha: Int, red: Int, green: Int, blue: Int): Int =
            ((alpha and 0xFF) shl 24) or ((red and 0xFF) shl 16) or
                ((green and 0xFF) shl 8) or (blue and 0xFF)
    }
}
