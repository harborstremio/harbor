package android.widget

import android.content.Context
import android.graphics.drawable.Drawable
import android.view.View

open class ImageView(context: Context?) : View(context) {
    var imageDrawable: Drawable? = null
    var scaleType: Int = 0
}
