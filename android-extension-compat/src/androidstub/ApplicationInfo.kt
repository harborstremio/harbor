package android.content.pm

import harbor.compat.host.PlatformHost

class ApplicationInfo {

    @JvmField
    var dataDir: String = PlatformHost.dataDir.absolutePath
}
