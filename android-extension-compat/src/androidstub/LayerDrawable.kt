package android.graphics.drawable

import android.graphics.Canvas
import android.graphics.ColorFilter

open class LayerDrawable(array: Array<Drawable?>) : Drawable() {

    private val layers: List<Drawable> = array.filterNotNull()

    open fun getNumberOfLayers(): Int = layers.size

    open fun getDrawable(index: Int): Drawable? = layers.getOrNull(index)

    override fun draw(canvas: Canvas?) {
        for (layer in layers) layer.draw(canvas)
    }

    override fun setBounds(left: Int, top: Int, right: Int, bottom: Int) {
        super.setBounds(left, top, right, bottom)
        for (layer in layers) layer.setBounds(left, top, right, bottom)
    }

    override fun setAlpha(alpha: Int) {
        super.setAlpha(alpha)
        for (layer in layers) layer.setAlpha(alpha)
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        super.setColorFilter(colorFilter)
        for (layer in layers) layer.setColorFilter(colorFilter)
    }

    override fun getIntrinsicWidth(): Int = layers.maxOfOrNull { it.getIntrinsicWidth() } ?: -1

    override fun getIntrinsicHeight(): Int = layers.maxOfOrNull { it.getIntrinsicHeight() } ?: -1
}
