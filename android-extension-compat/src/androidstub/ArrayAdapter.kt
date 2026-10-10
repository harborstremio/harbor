package android.widget

import android.content.Context

open class ArrayAdapter<T>(
    private val context: Context?,
    resource: Int,
    private val objects: List<T>,
) : SpinnerAdapter {

    var dropDownViewResource: Int = resource

    open fun getContext(): Context? = context

    override fun getCount(): Int = objects.size

    override fun getItem(position: Int): Any? = objects.getOrNull(position)

    override fun getItemId(position: Int): Long = position.toLong()

    override fun isEmpty(): Boolean = objects.isEmpty()

    open fun getPosition(item: T): Int = objects.indexOf(item)

    open fun notifyDataSetChanged() {}
}
