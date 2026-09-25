package android.graphics.drawable

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.PixelFormat

/** Extensions subclass this and override draw, setAlpha, setColorFilter and getOpacity, so each
 *  one is open with a working body: an abstract member here is an error the loader only finds
 *  when the line runs. */
open class Drawable {

    private var boundsLeft: Int = 0
    private var boundsTop: Int = 0
    private var boundsRight: Int = 0
    private var boundsBottom: Int = 0

    private var alphaValue: Int = 255
    private var filter: ColorFilter? = null
    private var visibleValue: Boolean = true

    open fun draw(canvas: Canvas?) {
    }

    open fun setAlpha(alpha: Int) {
        alphaValue = alpha.coerceIn(0, 255)
    }

    open fun getAlpha(): Int = alphaValue

    open fun setColorFilter(colorFilter: ColorFilter?) {
        filter = colorFilter
    }

    open fun getColorFilter(): ColorFilter? = filter

    open fun clearColorFilter() {
        filter = null
    }

    open fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    open fun setBounds(left: Int, top: Int, right: Int, bottom: Int) {
        boundsLeft = left
        boundsTop = top
        boundsRight = right
        boundsBottom = bottom
    }

    fun getBoundsLeft(): Int = boundsLeft

    fun getBoundsTop(): Int = boundsTop

    fun getBoundsRight(): Int = boundsRight

    fun getBoundsBottom(): Int = boundsBottom

    open fun getIntrinsicWidth(): Int = -1

    open fun getIntrinsicHeight(): Int = -1

    open fun mutate(): Drawable = this

    open fun invalidateSelf() {
    }

    open fun setVisible(visible: Boolean, restart: Boolean): Boolean {
        val changed = visible != visibleValue
        visibleValue = visible
        return changed
    }

    open fun isVisible(): Boolean = visibleValue
}
