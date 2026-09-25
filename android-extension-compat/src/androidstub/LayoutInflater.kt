package android.view

import android.content.Context
import android.widget.FrameLayout
import org.xmlpull.v1.XmlPullParser

open class LayoutInflater(val context: Context?) {

    // There is no resource table off device, so a layout resolves to an empty container. Callers
    // then find no children by id, which is the same answer Android gives for an absent id.
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
