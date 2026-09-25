package androidx.fragment.app

import android.content.Context
import android.content.res.Resources
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import harbor.compat.host.PlatformHost

open class Fragment {

    @JvmField
    internal var manager: FragmentManager? = null

    @JvmField
    internal var fragmentTag: String? = null

    @JvmField
    internal var attached: Boolean = false

    @JvmField
    internal var started: Boolean = false

    @JvmField
    internal var view: View? = null

    open fun getActivity(): FragmentActivity? = manager?.owner

    /** A detached fragment answers with the application context rather than null: extensions read
     * it to build views and to reach preferences, and both work off any context. */
    open fun getContext(): Context = getActivity() ?: PlatformHost.applicationContext

    open fun requireContext(): Context = getContext()

    open fun requireActivity(): FragmentActivity? = getActivity()

    open fun getParentFragmentManager(): FragmentManager? = manager

    open fun getFragmentManager(): FragmentManager? = manager

    open fun getResources(): Resources = getContext().getResources()

    open fun getTag(): String? = fragmentTag

    open fun isAdded(): Boolean = attached

    open fun isDetached(): Boolean = !attached

    open fun isVisible(): Boolean = started

    open fun getView(): View? = view

    open fun onCreate(savedInstanceState: Bundle?) {}

    open fun onCreateView(
        inflater: LayoutInflater?,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? = null

    open fun onViewCreated(view: View?, savedInstanceState: Bundle?) {}

    open fun onStart() {
        started = true
    }

    open fun onResume() {}

    open fun onPause() {}

    open fun onStop() {
        started = false
    }

    open fun onDestroyView() {
        view = null
    }

    open fun onDestroy() {
        started = false
        attached = false
    }
}
