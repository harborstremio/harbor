package android.graphics.drawable

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat

open class ColorDrawable(color: Int = 0) : Drawable() {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        paint.color = color
    }

    fun getColor(): Int = paint.color

    fun setColor(color: Int) {
        paint.color = color
    }

    fun getPaint(): Paint = paint

    override fun draw(canvas: Canvas?) {
        canvas?.drawRect(
            getBoundsLeft().toFloat(),
            getBoundsTop().toFloat(),
            getBoundsRight().toFloat(),
            getBoundsBottom().toFloat(),
            paint,
        )
    }

    override fun setAlpha(alpha: Int) {
        super.setAlpha(alpha)
        paint.setAlpha(alpha)
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        super.setColorFilter(colorFilter)
        paint.setColorFilter(colorFilter)
    }

    override fun getOpacity(): Int =
        if (paint.getAlpha() == 255) PixelFormat.OPAQUE else PixelFormat.TRANSLUCENT
}
