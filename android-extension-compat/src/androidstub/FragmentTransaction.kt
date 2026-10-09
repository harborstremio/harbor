package androidx.fragment.app

open class FragmentTransaction(private val manager: FragmentManager? = null) {

    private val additions = ArrayList<Pair<Fragment, String?>>()
    private val removals = ArrayList<Fragment>()
    private var committed: Boolean = false

    open fun add(fragment: Fragment?, tag: String?): FragmentTransaction {
        if (fragment != null) additions.add(fragment to tag)
        return this
    }

    open fun add(containerViewId: Int, fragment: Fragment?, tag: String?): FragmentTransaction =
        add(fragment, tag)

    open fun replace(containerViewId: Int, fragment: Fragment?, tag: String?): FragmentTransaction =
        add(fragment, tag)

    open fun remove(fragment: Fragment?): FragmentTransaction {
        if (fragment != null) removals.add(fragment)
        return this
    }

    open fun setReorderingAllowed(allowed: Boolean): FragmentTransaction = this

    open fun addToBackStack(name: String?): FragmentTransaction = this

    open fun commit(): Int = run()

    open fun commitAllowingStateLoss(): Int = run()

    open fun commitNow() {
        run()
    }

    open fun commitNowAllowingStateLoss() {
        run()
    }

    open fun isEmpty(): Boolean = additions.isEmpty() && removals.isEmpty()

    private fun run(): Int {
        if (committed) return 0
        committed = true
        val into = manager ?: return 0
        removals.forEach { into.detach(it) }
        additions.forEach { into.attach(it.first, it.second) }
        return into.nextCommitId()
    }
}
