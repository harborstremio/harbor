package android.graphics

/** Records the outline an extension builds so a renderer can walk it later. The cursor drawable
 *  the dialogs ship is seven line segments and a close, and it has to survive a transform. */
open class Path {

    enum class Verb { MOVE, LINE, CLOSE }

    enum class Direction { CW, CCW }

    enum class FillType { WINDING, EVEN_ODD, INVERSE_WINDING, INVERSE_EVEN_ODD }

    class Node(val verb: Verb, var x: Float, var y: Float)

    private val nodes = ArrayList<Node>()

    private var lastX = 0f
    private var lastY = 0f

    var fillType: FillType? = FillType.WINDING

    val segments: List<Node>
        get() = nodes

    fun moveTo(x: Float, y: Float) {
        nodes.add(Node(Verb.MOVE, x, y))
        lastX = x
        lastY = y
    }

    fun lineTo(x: Float, y: Float) {
        nodes.add(Node(Verb.LINE, x, y))
        lastX = x
        lastY = y
    }

    fun rMoveTo(dx: Float, dy: Float) = moveTo(lastX + dx, lastY + dy)

    fun rLineTo(dx: Float, dy: Float) = lineTo(lastX + dx, lastY + dy)

    fun close() {
        nodes.add(Node(Verb.CLOSE, lastX, lastY))
    }

    fun reset() {
        nodes.clear()
        lastX = 0f
        lastY = 0f
    }

    fun rewind() = reset()

    fun isEmpty(): Boolean = nodes.isEmpty()

    fun set(source: Path?) {
        reset()
        if (source == null) return
        for (n in source.nodes) nodes.add(Node(n.verb, n.x, n.y))
        lastX = source.lastX
        lastY = source.lastY
        fillType = source.fillType
    }

    fun addPath(source: Path?) {
        if (source == null) return
        for (n in source.nodes) nodes.add(Node(n.verb, n.x, n.y))
        lastX = source.lastX
        lastY = source.lastY
    }

    fun transform(matrix: Matrix?) {
        if (matrix == null) return
        for (n in nodes) {
            val x = n.x
            val y = n.y
            n.x = matrix.mapX(x, y)
            n.y = matrix.mapY(x, y)
        }
        val px = lastX
        val py = lastY
        lastX = matrix.mapX(px, py)
        lastY = matrix.mapY(px, py)
    }

    fun transform(matrix: Matrix?, destination: Path?) {
        if (destination == null) {
            transform(matrix)
            return
        }
        destination.set(this)
        destination.transform(matrix)
    }

    /** Left, top, right, bottom. All zeroes for an empty path, which is what a renderer wants
     *  when it has nothing to draw. */
    fun computeBounds(): FloatArray {
        if (nodes.isEmpty()) return floatArrayOf(0f, 0f, 0f, 0f)
        var left = Float.MAX_VALUE
        var top = Float.MAX_VALUE
        var right = -Float.MAX_VALUE
        var bottom = -Float.MAX_VALUE
        for (n in nodes) {
            if (n.x < left) left = n.x
            if (n.y < top) top = n.y
            if (n.x > right) right = n.x
            if (n.y > bottom) bottom = n.y
        }
        return floatArrayOf(left, top, right, bottom)
    }
}
