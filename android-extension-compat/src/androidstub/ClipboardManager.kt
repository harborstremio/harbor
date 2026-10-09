package android.content

import harbor.compat.host.PlatformHost

open class ClipboardManager {

    private var clip: ClipData? = null

    open fun setPrimaryClip(clip: ClipData?) {
        this.clip = clip
        val text = clip?.getItemAt(0)?.getText()?.toString() ?: return
        PlatformHost.copyToClipboard(clip.label?.toString(), text)
    }

    open fun getPrimaryClip(): ClipData? = clip

    open fun hasPrimaryClip(): Boolean = clip != null
}
