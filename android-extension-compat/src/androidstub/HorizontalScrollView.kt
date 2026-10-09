package android.widget

import android.content.Context
import android.view.View

open class HorizontalScrollView(context: Context?) : FrameLayout(context) {

    var isHorizontalScrollBarEnabled: Boolean = false

    override fun addView(child: View?) {
        if (child == null) return
        if (getChildCount() > 0) removeAllViews()
        super.addView(child)
    }
}
