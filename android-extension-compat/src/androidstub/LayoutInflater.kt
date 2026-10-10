package android.view

import android.content.Context
import android.widget.FrameLayout
import org.xmlpull.v1.XmlPullParser

open class LayoutInflater(val context: Context?) {

    open fun inflate(parser: XmlPullParser?, root: ViewGroup?, attachToRoot: Boolean): View {
        val view = FrameLayout(context)
        if (root == null) return view
        view.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
        if (!attachToRoot) return view
        root.addView(view)
        return root
    }

    companion object {
        @JvmStatic
        fun from(context: Context?): LayoutInflater = LayoutInflater(context)
    }
}
