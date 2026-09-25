package android.graphics

/** A recording surface. Nothing rasterises here, so every draw call is kept in order and a host
 *  renderer replays the list. Dropping the calls would make a custom drawable silently blank. */
open class Canvas {

    enum class OpKind { PATH, RECT, COLOR }

    class Op(
        val kind: OpKind,
        val path: Path?,
        val paint: Paint?,
        val color: Int,
        val left: Float,
        val top: Float,
        val right: Float,
        val bottom: Float,
    )

    var bitmap: Bitmap? = null

    private val recorded = ArrayList<Op>()

    constructor()

    constructor(bitmap: Bitmap?) {
        this.bitmap = bitmap
    }

    val ops: List<Op>
        get() = recorded

    fun getWidth(): Int = bitmap?.width ?: 0

    fun getHeight(): Int = bitmap?.height ?: 0

    fun drawPath(path: Path?, paint: Paint?) {
        recorded.add(Op(OpKind.PATH, path, paint, paint?.color ?: 0, 0f, 0f, 0f, 0f))
    }

    fun drawRect(left: Float, top: Float, right: Float, bottom: Float, paint: Paint?) {
        recorded.add(Op(OpKind.RECT, null, paint, paint?.color ?: 0, left, top, right, bottom))
    }

    fun drawColor(color: Int) {
        recorded.add(Op(OpKind.COLOR, null, null, color, 0f, 0f, 0f, 0f))
    }

    fun clear() {
        recorded.clear()
    }
}
