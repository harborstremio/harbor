package android.graphics

/** A real 3x3 affine transform. Paths are handed one and expect their points to move. */
open class Matrix {

    private val m = FloatArray(9)

    init {
        reset()
    }

    fun reset() {
        m[0] = 1f; m[1] = 0f; m[2] = 0f
        m[3] = 0f; m[4] = 1f; m[5] = 0f
        m[6] = 0f; m[7] = 0f; m[8] = 1f
    }

    fun isIdentity(): Boolean =
        m[0] == 1f && m[1] == 0f && m[2] == 0f &&
            m[3] == 0f && m[4] == 1f && m[5] == 0f &&
            m[6] == 0f && m[7] == 0f && m[8] == 1f

    fun setScale(sx: Float, sy: Float) {
        reset()
        m[0] = sx
        m[4] = sy
    }

    fun setScale(sx: Float, sy: Float, px: Float, py: Float) {
        reset()
        m[0] = sx
        m[4] = sy
        m[2] = px - sx * px
        m[5] = py - sy * py
    }

    fun setTranslate(dx: Float, dy: Float) {
        reset()
        m[2] = dx
        m[5] = dy
    }

    fun postTranslate(dx: Float, dy: Float) {
        m[2] += dx
        m[5] += dy
    }

    fun postScale(sx: Float, sy: Float) {
        m[0] *= sx; m[1] *= sx; m[2] *= sx
        m[3] *= sy; m[4] *= sy; m[5] *= sy
    }

    fun getValues(values: FloatArray?) {
        if (values == null || values.size < 9) return
        System.arraycopy(m, 0, values, 0, 9)
    }

    fun setValues(values: FloatArray?) {
        if (values == null || values.size < 9) return
        System.arraycopy(values, 0, m, 0, 9)
    }

    fun set(source: Matrix?) {
        if (source == null) reset() else System.arraycopy(source.m, 0, m, 0, 9)
    }

    fun mapX(x: Float, y: Float): Float = m[0] * x + m[1] * y + m[2]

    fun mapY(x: Float, y: Float): Float = m[3] * x + m[4] * y + m[5]

    /** Transforms interleaved x, y pairs in place. A short or odd array is left alone. */
    fun mapPoints(points: FloatArray?) {
        if (points == null) return
        var i = 0
        while (i + 1 < points.size) {
            val x = points[i]
            val y = points[i + 1]
            points[i] = mapX(x, y)
            points[i + 1] = mapY(x, y)
            i += 2
        }
    }

    override fun toString(): String =
        "Matrix{[${m[0]}, ${m[1]}, ${m[2]}][${m[3]}, ${m[4]}, ${m[5]}][${m[6]}, ${m[7]}, ${m[8]}]}"
}
