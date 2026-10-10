package android.view

interface ViewParent {
    fun requestLayout()

    fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {}
}
