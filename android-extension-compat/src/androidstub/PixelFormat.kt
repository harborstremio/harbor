package android.graphics

/** Opacity constants a drawable reports back from getOpacity. */
open class PixelFormat {
    companion object {
        const val UNKNOWN: Int = 0
        const val TRANSLUCENT: Int = -3
        const val TRANSPARENT: Int = -2
        const val OPAQUE: Int = -1
        const val RGBA_8888: Int = 1
        const val RGB_565: Int = 4
    }
}
