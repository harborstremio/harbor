package android.graphics.drawable

import android.content.res.Resources
import android.graphics.Bitmap

open class BitmapDrawable(
    private val resources: Resources?,
    private val bitmap: Bitmap?,
) : Drawable() {

    open fun getBitmap(): Bitmap? = bitmap

    open fun getResources(): Resources? = resources

    override fun getIntrinsicWidth(): Int = bitmap?.width ?: -1

    override fun getIntrinsicHeight(): Int = bitmap?.height ?: -1
}
