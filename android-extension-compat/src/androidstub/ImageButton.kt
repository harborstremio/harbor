package android.widget

import android.content.Context

open class ImageButton(context: Context?) : ImageView(context) {
    init {
        isClickable = true
        isFocusable = true
    }
}
