package android.view

import android.content.Context
import android.graphics.drawable.Drawable
import android.widget.FrameLayout

open class Window @JvmOverloads constructor(val context: Context? = null) {

    var flags: Int = 0
    var dimAmount: Float = 0f
    var gravity: Int = 0
    var backgroundDrawable: Drawable? = null
    var layoutWidth: Int = ViewGroup.LayoutParams.MATCH_PARENT
    var layoutHeight: Int = ViewGroup.LayoutParams.MATCH_PARENT

    private val decor: View = FrameLayout(context)

    open fun getDecorView(): View = decor

    open fun addFlags(flags: Int) {
        this.flags = this.flags or flags
    }

    open fun clearFlags(flags: Int) {
        this.flags = this.flags and flags.inv()
    }

    open fun setLayout(width: Int, height: Int) {
        layoutWidth = width
        layoutHeight = height
    }
}
