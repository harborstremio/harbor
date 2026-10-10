package androidx.recyclerview.widget

import android.content.Context
import android.view.View
import android.view.ViewGroup
import harbor.compat.host.PlatformHost

open class RecyclerView(context: Context?) : ViewGroup(context) {

    abstract class ViewHolder(@JvmField val itemView: View) {
        var bindingAdapterPosition: Int = NO_POSITION
            internal set
    }

    abstract class Adapter<VH : ViewHolder> {

        private var attached: RecyclerView? = null

        abstract fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH

        abstract fun onBindViewHolder(holder: VH, position: Int)

        abstract fun getItemCount(): Int

        open fun getItemViewType(position: Int): Int = 0

        open fun notifyDataSetChanged() {
            attached?.refresh()
        }

        open fun notifyItemChanged(position: Int) {
            attached?.refresh()
        }

        open fun notifyItemInserted(position: Int) {
            attached?.refresh()
        }

        open fun notifyItemRemoved(position: Int) {
            attached?.refresh()
        }

        internal fun attachTo(view: RecyclerView?) {
            attached = view
        }
    }

    open class LayoutManager

    var adapter: Adapter<*>? = null
        set(value) {
            field?.attachTo(null)
            field = value
            value?.attachTo(this)
            if (bound) refresh()
        }

    var layoutManager: LayoutManager? = null

    private var bound = false

    fun bindRows() {
        bound = true
        refresh()
    }

    private fun refresh() {
        if (!bound) return
        val current = adapter ?: return
        removeAllViews()
        val count = try {
            current.getItemCount()
        } catch (t: Throwable) {
            0
        }
        for (position in 0 until count) {
            try {
                bindRow(current, position)
            } catch (t: Throwable) {
                PlatformHost.log(5, "RecyclerView", "row $position failed", t)
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun bindRow(adapter: Adapter<*>, position: Int) {
        val untyped = adapter as Adapter<ViewHolder>
        val holder = untyped.onCreateViewHolder(this, untyped.getItemViewType(position))
        holder.bindingAdapterPosition = position
        untyped.onBindViewHolder(holder, position)
        addView(holder.itemView)
    }

    companion object {
        const val NO_POSITION: Int = -1
    }
}
