package harbor.compat.host

import java.io.File
import java.security.Key
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.Certificate
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

class KeyVault private constructor(private val file: File) {

    private val lock = Any()

    private var opened: KeyStore? = null

    private val passphrase: CharArray by lazy { passphraseIn(File(file.parentFile, PASSPHRASE)) }

    fun open(): KeyStore = synchronized(lock) {
        opened?.let { return it }
        val store = KeyStore.getInstance("PKCS12")
        if (file.isFile) {
            file.inputStream().use { store.load(it, passphrase) }
        } else {
            store.load(null, passphrase)
        }
        opened = store
        store
    }

    fun key(alias: String, password: CharArray?): Key? =
        open().getKey(alias, password ?: passphrase)

    fun put(alias: String, key: Key, password: CharArray?, chain: Array<Certificate>?) {
        synchronized(lock) {
            open().setKeyEntry(alias, key, password ?: passphrase, chain)
            write()
        }
    }

    fun putCertificate(alias: String, certificate: Certificate) {
        synchronized(lock) {
            open().setCertificateEntry(alias, certificate)
            write()
        }
    }

    fun remove(alias: String) {
        synchronized(lock) {
            open().deleteEntry(alias)
            write()
        }
    }

    fun save() {
        synchronized(lock) { write() }
    }

    private fun write() {
        val store = opened ?: return
        file.parentFile?.mkdirs()
        val temp = File(file.parentFile, file.name + ".tmp")
        temp.outputStream().use { store.store(it, passphrase) }
        if (!temp.renameTo(file)) {
            file.delete()
            if (!temp.renameTo(file)) {
                file.outputStream().use { store.store(it, passphrase) }
                temp.delete()
            }
        }
        restrict(file)
    }

    private fun passphraseIn(at: File): CharArray {
        if (at.isFile) {
            val existing = at.readText().trim()
            if (existing.isNotEmpty()) return existing.toCharArray()
        }
        val fresh = ByteArray(32)
        SecureRandom().nextBytes(fresh)
        val text = Base64.getUrlEncoder().withoutPadding().encodeToString(fresh)
        at.parentFile?.mkdirs()
        at.writeText(text)
        restrict(at)
        return text.toCharArray()
    }

    // Windows ignores all four calls, so this is owner only on unix and no claim anywhere.
    private fun restrict(target: File) {
        target.setReadable(false, false)
        target.setWritable(false, false)
        target.setReadable(true, true)
        target.setWritable(true, true)
    }

    companion object {

        private const val PASSPHRASE = "passphrase"

        private const val STORE = "keystore.p12"

        private val vaults = ConcurrentHashMap<String, KeyVault>()

        fun of(directory: File): KeyVault {
            val store = File(directory, STORE)
            return vaults.getOrPut(store.absolutePath) { KeyVault(store) }
        }

        fun current(): KeyVault = of(File(PlatformHost.dataDir, "keystore"))
    }
}
