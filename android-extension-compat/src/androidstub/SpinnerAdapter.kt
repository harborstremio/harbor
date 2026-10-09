package android.widget

interface SpinnerAdapter {

    fun getCount(): Int

    fun getItem(position: Int): Any?

    fun getItemId(position: Int): Long

    fun isEmpty(): Boolean
}
