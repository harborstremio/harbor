package android.graphics.drawable

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat

/** Every dialog surface in the sample extensions is one of these: a rounded rectangle with a
 *  solid or two stop fill and a stroke. All of it is read back by the renderer, so all of it
 *  is stored. */
open class GradientDrawable : Drawable {

    enum class Orientation {
        TOP_BOTTOM, TR_BL, RIGHT_LEFT, BR_TL, BOTTOM_TOP, BL_TR, LEFT_RIGHT, TL_BR
    }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    private var gradientColors: IntArray? = null
    private var gradientOrientation: Orientation? = Orientation.TOP_BOTTOM
    private var radius: Float = 0f
    private var radii: FloatArray? = null
    private var strokeWidth: Int = 0
    private var strokeColor: Int = 0
    private var shapeValue: Int = RECTANGLE

    constructor() : super()

    constructor(orientation: Orientation?, colors: IntArray?) : super() {
        gradientOrientation = orientation
        setColors(colors)
    }

    fun setColor(color: Int) {
        gradientColors = null
        paint.color = color
    }

    fun getColor(): Int = paint.color

    fun setColors(colors: IntArray?) {
        gradientColors = colors?.copyOf()
        val first = colors?.firstOrNull()
        if (first != null) paint.color = first
    }

    fun getColors(): IntArray? = gradientColors?.copyOf()

    fun setOrientation(orientation: Orientation?) {
        gradientOrientation = orientation
    }

    fun getOrientation(): Orientation? = gradientOrientation

    fun setCornerRadius(cornerRadius: Float) {
        radius = cornerRadius
        radii = null
    }

    fun getCornerRadius(): Float = radius

    /** Eight floats, one x and one y per corner, top left first. */
    fun setCornerRadii(cornerRadii: FloatArray?) {
        radii = cornerRadii?.copyOf()
        if (cornerRadii != null) radius = 0f
    }

    fun getCornerRadii(): FloatArray? = radii?.copyOf()

    fun setStroke(width: Int, color: Int) {
        strokeWidth = width
        strokeColor = color
    }

    fun getStrokeWidth(): Int = strokeWidth

    fun getStrokeColor(): Int = strokeColor

    fun setShape(shape: Int) {
        shapeValue = shape
    }

    fun getShape(): Int = shapeValue

    override fun setAlpha(alpha: Int) {
        super.setAlpha(alpha)
        paint.setAlpha(alpha)
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        super.setColorFilter(colorFilter)
        paint.setColorFilter(colorFilter)
    }

    override fun draw(canvas: Canvas?) {
        canvas?.drawRect(
            getBoundsLeft().toFloat(),
            getBoundsTop().toFloat(),
            getBoundsRight().toFloat(),
            getBoundsBottom().toFloat(),
            paint,
        )
    }

    override fun getOpacity(): Int =
        if (paint.getAlpha() == 255) PixelFormat.OPAQUE else PixelFormat.TRANSLUCENT

    companion object {
        const val RECTANGLE: Int = 0
        const val OVAL: Int = 1
        const val LINE: Int = 2
        const val RING: Int = 3
        const val LINEAR_GRADIENT: Int = 0
        const val RADIAL_GRADIENT: Int = 1
        const val SWEEP_GRADIENT: Int = 2
    }
}
