package android.view

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Resources
import android.graphics.drawable.Drawable
import java.util.concurrent.atomic.AtomicInteger

open class View(val context: Context?) {

    interface OnClickListener {
        fun onClick(v: View?)
    }

    interface OnFocusChangeListener {
        fun onFocusChange(v: View?, hasFocus: Boolean)
    }

    interface OnKeyListener {
        fun onKey(v: View?, keyCode: Int, event: KeyEvent?): Boolean
    }

    interface OnTouchListener {
        fun onTouch(v: View?, event: MotionEvent?): Boolean
    }

    var id: Int = NO_ID
    var layoutParams: ViewGroup.LayoutParams? = null
    var background: Drawable? = null
    var backgroundColor: Int = 0
    var backgroundTintList: ColorStateList? = null
    var visibility: Int = VISIBLE
    var alpha: Float = 1f
    var elevation: Float = 0f
    var translationX: Float = 0f
    var translationY: Float = 0f
    var width: Int = 0
    var height: Int = 0
    var clipToOutline: Boolean = false
    var isClickable: Boolean = false
    var isEnabled: Boolean = true
    var isFocusable: Boolean = false
    var isFocusableInTouchMode: Boolean = false
    var isFocused: Boolean = false
    var systemUiVisibility: Int = 0
    var nextFocusUpId: Int = NO_ID
    var nextFocusDownId: Int = NO_ID
    var nextFocusLeftId: Int = NO_ID
    var nextFocusRightId: Int = NO_ID
    var nextFocusForwardId: Int = NO_ID
    var paddingLeft: Int = 0
    var paddingTop: Int = 0
    var paddingRight: Int = 0
    var paddingBottom: Int = 0
    var isLayoutRequested: Boolean = false
    var onClickListener: OnClickListener? = null
    var onFocusChangeListener: OnFocusChangeListener? = null
    var onKeyListener: OnKeyListener? = null

    private var viewParent: ViewParent? = null

    open fun getParent(): ViewParent? = viewParent

    open fun assignParent(parent: ViewParent?) {
        viewParent = parent
    }

    open fun setPadding(left: Int, top: Int, right: Int, bottom: Int) {
        paddingLeft = left
        paddingTop = top
        paddingRight = right
        paddingBottom = bottom
    }

    open fun requestLayout() {
        isLayoutRequested = true
    }

    open fun findViewById(id: Int): View? = if (id != NO_ID && id == this.id) this else null

    open fun performClick(): Boolean {
        val l = onClickListener ?: return false
        try {
            l.onClick(this)
        } catch (t: Throwable) {
            return false
        }
        return true
    }

    open fun requestFocus(): Boolean {
        if (!isFocusable && !isFocusableInTouchMode) return false
        if (isFocused) return true
        isFocused = true
        try {
            onFocusChangeListener?.onFocusChange(this, true)
        } catch (t: Throwable) {
            return true
        }
        return true
    }

    open fun requestFocusFromTouch(): Boolean {
        if (!isFocusableInTouchMode) isFocusableInTouchMode = isFocusable
        return requestFocus()
    }

    open fun dispatchKeyEvent(event: KeyEvent?): Boolean {
        val l = onKeyListener ?: return false
        return try {
            l.onKey(this, event?.keyCode ?: KeyEvent.KEYCODE_UNKNOWN, event)
        } catch (t: Throwable) {
            false
        }
    }

    open fun clearFocus() {
        if (!isFocused) return
        isFocused = false
        try {
            onFocusChangeListener?.onFocusChange(this, false)
        } catch (t: Throwable) {
        }
    }

    open fun post(action: Runnable?): Boolean {
        if (action == null) return false
        try {
            action.run()
        } catch (t: Throwable) {
        }
        return true
    }

    open fun getResources(): Resources? = context?.getResources()

    companion object {
        const val NO_ID: Int = -1
        const val VISIBLE: Int = 0
        const val INVISIBLE: Int = 4
        const val GONE: Int = 8

        private val generatedId = AtomicInteger(1)

        @JvmStatic
        fun generateViewId(): Int {
            while (true) {
                val current = generatedId.get()
                val next = if (current + 1 > GENERATED_ID_LIMIT) 1 else current + 1
                if (generatedId.compareAndSet(current, next)) return current
            }
        }

        // Android's own ceiling: above it a generated id collides with an aapt R.id value.
        private const val GENERATED_ID_LIMIT: Int = 0x00FFFFFF
    }
}
