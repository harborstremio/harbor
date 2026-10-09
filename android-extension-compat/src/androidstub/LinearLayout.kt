package android.widget

import android.content.Context
import android.view.ViewGroup

open class LinearLayout(context: Context?) : ViewGroup(context) {

    open class LayoutParams : ViewGroup.MarginLayoutParams {

        @JvmField var weight: Float = 0f

        constructor(width: Int, height: Int) : super(width, height)

        constructor(width: Int, height: Int, weight: Float) : super(width, height) {
            this.weight = weight
        }
    }

    var orientation: Int = HORIZONTAL
    var gravity: Int = 0
    var weightSum: Float = 0f

    companion object {
        const val HORIZONTAL: Int = 0
        const val VERTICAL: Int = 1
    }
}
