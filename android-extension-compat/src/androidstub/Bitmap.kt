package android.graphics

open class Bitmap(val width: Int = 0, val height: Int = 0) {

    enum class Config { ALPHA_8, RGB_565, ARGB_4444, ARGB_8888, RGBA_F16, HARDWARE }

    var config: Config? = Config.ARGB_8888

    private var recycled: Boolean = false

    fun isRecycled(): Boolean = recycled

    fun recycle() {
        recycled = true
    }

    fun getByteCount(): Int = width * height * 4

    companion object {
        @JvmStatic
        fun createBitmap(width: Int, height: Int, config: Config?): Bitmap {
            val b = Bitmap(maxOf(0, width), maxOf(0, height))
            b.config = config
            return b
        }
    }
}
