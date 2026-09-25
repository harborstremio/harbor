package android.content

import android.net.Uri

open class Intent @JvmOverloads constructor(
    private var action: String? = null,
    private var data: Uri? = null,
) {

    private var component: ComponentName? = null
    private var packageName: String? = null
    private var flags: Int = 0
    private val extras = LinkedHashMap<String, Any?>()

    open fun getAction(): String? = action

    open fun setAction(action: String?): Intent {
        this.action = action
        return this
    }

    open fun getData(): Uri? = data

    open fun setData(data: Uri?): Intent {
        this.data = data
        return this
    }

    open fun getComponent(): ComponentName? = component

    open fun setComponent(component: ComponentName?): Intent {
        this.component = component
        return this
    }

    open fun getPackage(): String? = packageName

    open fun setPackage(packageName: String?): Intent {
        this.packageName = packageName
        return this
    }

    open fun getFlags(): Int = flags

    open fun setFlags(flags: Int): Intent {
        this.flags = flags
        return this
    }

    open fun addFlags(flags: Int): Intent {
        this.flags = this.flags or flags
        return this
    }

    open fun putExtra(name: String, value: String?): Intent {
        extras[name] = value
        return this
    }

    open fun getStringExtra(name: String): String? = extras[name] as? String

    open fun getExtras(): Map<String, Any?> = LinkedHashMap(extras)

    override fun toString(): String =
        "Intent { act=$action dat=$data cmp=${component?.flattenToString()} flg=$flags }"

    companion object {

        const val ACTION_MAIN: String = "android.intent.action.MAIN"
        const val ACTION_VIEW: String = "android.intent.action.VIEW"
        const val ACTION_SEND: String = "android.intent.action.SEND"
        const val CATEGORY_LAUNCHER: String = "android.intent.category.LAUNCHER"
        const val FLAG_ACTIVITY_NEW_TASK: Int = 0x10000000
        const val FLAG_ACTIVITY_CLEAR_TASK: Int = 0x00008000
        const val FLAG_ACTIVITY_CLEAR_TOP: Int = 0x04000000

        @JvmStatic
        fun makeRestartActivityTask(target: ComponentName?): Intent {
            val intent = Intent(ACTION_MAIN, null)
            intent.setComponent(target)
            intent.setFlags(FLAG_ACTIVITY_NEW_TASK or FLAG_ACTIVITY_CLEAR_TASK)
            return intent
        }
    }
}
