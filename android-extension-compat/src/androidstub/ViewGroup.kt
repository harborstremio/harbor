package android.view

import android.content.Context

open class ViewGroup(context: Context?) : View(context), ViewParent {

    open class LayoutParams(@JvmField var width: Int, @JvmField var height: Int) {
        companion object {
            const val MATCH_PARENT: Int = -1
            const val FILL_PARENT: Int = -1
            const val WRAP_CONTENT: Int = -2
        }
    }

    open class MarginLayoutParams(width: Int, height: Int) : LayoutParams(width, height) {
        @JvmField var leftMargin: Int = 0
        @JvmField var topMargin: Int = 0
        @JvmField var rightMargin: Int = 0
        @JvmField var bottomMargin: Int = 0

        fun setMargins(left: Int, top: Int, right: Int, bottom: Int) {
            leftMargin = left
            topMargin = top
            rightMargin = right
            bottomMargin = bottom
        }
    }

    var descendantFocusability: Int = FOCUS_BEFORE_DESCENDANTS

    private val children = ArrayList<View>()

    open fun getChildCount(): Int = children.size

    open fun getChildAt(index: Int): View? = children.getOrNull(index)

    open fun addView(child: View?) {
        if (child == null || child === this) return
        (child.getParent() as? ViewGroup)?.removeView(child)
        children.add(child)
        child.assignParent(this)
    }

    open fun addView(child: View?, params: LayoutParams?) {
        if (child == null) return
        child.layoutParams = params
        addView(child)
    }

    open fun removeView(child: View?) {
        if (child == null) return
        if (children.remove(child)) child.assignParent(null)
    }

    open fun removeAllViews() {
        for (child in children) child.assignParent(null)
        children.clear()
    }

    override fun findViewById(id: Int): View? {
        val self = super.findViewById(id)
        if (self != null) return self
        for (child in children) {
            val hit = child.findViewById(id)
            if (hit != null) return hit
        }
        return null
    }

    companion object {
        const val FOCUS_BEFORE_DESCENDANTS: Int = 131072
        const val FOCUS_AFTER_DESCENDANTS: Int = 262144
        const val FOCUS_BLOCK_DESCENDANTS: Int = 393216
    }
}
