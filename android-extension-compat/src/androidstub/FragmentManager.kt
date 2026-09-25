package androidx.fragment.app

import android.view.LayoutInflater
import harbor.compat.host.PlatformHost
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

open class FragmentManager {

    @JvmField
    internal var owner: FragmentActivity? = null

    private val byTag = ConcurrentHashMap<String, Fragment>()
    private val live = CopyOnWriteArrayList<Fragment>()
    private val commits = AtomicInteger()
    private var destroyed: Boolean = false

    open fun beginTransaction(): FragmentTransaction = FragmentTransaction(this)

    open fun findFragmentByTag(tag: String?): Fragment? = if (tag == null) null else byTag[tag]

    open fun isDestroyed(): Boolean = destroyed || owner?.isDestroyed() == true

    open fun getFragments(): List<Fragment> = live.toList()

    open fun getBackStackEntryCount(): Int = 0

    open fun executePendingTransactions(): Boolean = true

    internal fun attach(fragment: Fragment, tag: String?) {
        if (isDestroyed()) return
        fragment.manager = this
        fragment.fragmentTag = tag
        fragment.attached = true
        if (tag != null) byTag[tag] = fragment
        if (!live.contains(fragment)) live.add(fragment)
        if (owner?.isStarted() != false) start(fragment)
    }

    internal fun detach(fragment: Fragment) {
        val tag = fragment.fragmentTag
        if (tag != null) byTag.remove(tag, fragment)
        live.remove(fragment)
        fragment.attached = false
    }

    internal fun nextCommitId(): Int = commits.incrementAndGet()

    /** The dispatch runs extension code that was written for a real screen. A host with nothing
     * wired behind a view can make that code fail, and that must not reach the caller, which is
     * usually a scrape waiting on a coroutine. */
    private fun start(fragment: Fragment) {
        try {
            fragment.onCreate(null)
            val dialog = (fragment as? DialogFragment)?.let {
                it.createDialog(null)
                it.getDialog()
            }
            val view = fragment.onCreateView(LayoutInflater.from(fragment.getContext()), null, null)
            fragment.view = view
            if (view != null) dialog?.setContentView(view)
            fragment.onViewCreated(view, null)
            fragment.onStart()
        } catch (error: Throwable) {
            PlatformHost.log(5, "FragmentManager", "fragment ${fragment.javaClass.name} failed to start", error)
        }
    }

    open fun dispatchStart() {
        live.forEach { if (!it.started) start(it) }
    }

    open fun dispatchDestroy() {
        destroyed = true
        live.forEach { fragment ->
            try {
                fragment.onDestroy()
            } catch (error: Throwable) {
                PlatformHost.log(5, "FragmentManager", "fragment ${fragment.javaClass.name} failed to stop", error)
            }
        }
        live.clear()
        byTag.clear()
    }
}
