package android.widget

import android.content.Context
import android.view.ViewGroup

open class FrameLayout(context: Context?) : ViewGroup(context) {

    open class LayoutParams @JvmOverloads constructor(
        width: Int,
        height: Int,
        @JvmField var gravity: Int = UNSPECIFIED_GRAVITY,
    ) : ViewGroup.MarginLayoutParams(width, height) {
        companion object {
            const val UNSPECIFIED_GRAVITY: Int = -1
        }
    }
}
