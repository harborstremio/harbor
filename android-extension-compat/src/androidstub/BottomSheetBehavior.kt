package com.google.android.material.bottomsheet

import android.view.View

open class BottomSheetBehavior<V : View> {

    private var peekHeight: Int = 0
    private var halfExpandedRatio: Float = 0.5f
    private var skipCollapsed: Boolean = false
    private var hideable: Boolean = true
    private var draggable: Boolean = true
    private var state: Int = STATE_COLLAPSED

    open fun getPeekHeight(): Int = peekHeight

    open fun setPeekHeight(height: Int) {
        peekHeight = height
    }

    open fun getHalfExpandedRatio(): Float = halfExpandedRatio

    open fun setHalfExpandedRatio(ratio: Float) {
        halfExpandedRatio = ratio
    }

    open fun getSkipCollapsed(): Boolean = skipCollapsed

    open fun setSkipCollapsed(skip: Boolean) {
        skipCollapsed = skip
    }

    open fun isHideable(): Boolean = hideable

    open fun setHideable(value: Boolean) {
        hideable = value
    }

    open fun isDraggable(): Boolean = draggable

    open fun setDraggable(value: Boolean) {
        draggable = value
    }

    open fun getState(): Int = state

    open fun setState(value: Int) {
        state = value
    }

    companion object {

        const val STATE_DRAGGING: Int = 1
        const val STATE_SETTLING: Int = 2
        const val STATE_EXPANDED: Int = 3
        const val STATE_COLLAPSED: Int = 4
        const val STATE_HIDDEN: Int = 5
        const val STATE_HALF_EXPANDED: Int = 6
        const val PEEK_HEIGHT_AUTO: Int = -1

        @JvmStatic
        fun from(view: View?): BottomSheetBehavior<View> = BottomSheetBehavior()
    }
}
