package harbor.compat.host

import android.security.keystore.KeyGenParameterSpec
import java.io.InputStream
import java.io.OutputStream
import java.security.InvalidAlgorithmParameterException
import java.security.Key
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyPairGeneratorSpi
import java.security.KeyStoreException
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.SecureRandom
import java.security.Security
import java.security.cert.Certificate
import java.security.spec.AlgorithmParameterSpec
import java.security.spec.ECGenParameterSpec
import java.util.Date
import java.util.Enumeration

class AndroidKeyStoreProvider : Provider(NAME, "1.0", "Local stand in for the Android keystore") {

    init {
        put("KeyStore.$NAME", VaultKeyStore::class.java.name)
        put("KeyPairGenerator.EC", VaultKeyPairGenerator::class.java.name)
    }

    companion object {

        const val NAME: String = "AndroidKeyStore"

        fun install() {
            if (Security.getProvider(NAME) != null) return
            Security.addProvider(AndroidKeyStoreProvider())
        }
    }
}

class VaultKeyStore : KeyStoreSpi() {

    private fun vault(): KeyVault = KeyVault.current()

    override fun engineLoad(stream: InputStream?, password: CharArray?) {
        vault().open()
    }

    override fun engineStore(stream: OutputStream?, password: CharArray?) {
        vault().save()
    }

    override fun engineAliases(): Enumeration<String> = vault().open().aliases()

    override fun engineContainsAlias(alias: String?): Boolean =
        alias != null && vault().open().containsAlias(alias)

    override fun engineSize(): Int = vault().open().size()

    override fun engineGetKey(alias: String?, password: CharArray?): Key? =
        alias?.let { vault().key(it, password) }

    override fun engineGetCertificateChain(alias: String?): Array<Certificate>? =
        alias?.let { vault().open().getCertificateChain(it) }

    override fun engineGetCertificate(alias: String?): Certificate? =
        alias?.let { vault().open().getCertificate(it) }

    override fun engineGetCreationDate(alias: String?): Date? =
        alias?.let { vault().open().getCreationDate(it) }

    override fun engineIsKeyEntry(alias: String?): Boolean =
        alias != null && vault().open().isKeyEntry(alias)

    override fun engineIsCertificateEntry(alias: String?): Boolean =
        alias != null && vault().open().isCertificateEntry(alias)

    override fun engineGetCertificateAlias(certificate: Certificate?): String? =
        certificate?.let { vault().open().getCertificateAlias(it) }

    override fun engineDeleteEntry(alias: String?) {
        if (alias != null) vault().remove(alias)
    }

    override fun engineSetKeyEntry(alias: String?, key: Key?, password: CharArray?, chain: Array<out Certificate>?) {
        if (alias == null || key == null) throw KeyStoreException("an entry needs both an alias and a key")
        @Suppress("UNCHECKED_CAST")
        vault().put(alias, key, password, chain as Array<Certificate>?)
    }

    override fun engineSetKeyEntry(alias: String?, key: ByteArray?, chain: Array<out Certificate>?) {
        throw KeyStoreException("this keystore takes a Key, not an already encoded one")
    }

    override fun engineSetCertificateEntry(alias: String?, certificate: Certificate?) {
        if (alias == null || certificate == null) throw KeyStoreException("an entry needs both an alias and a certificate")
        vault().putCertificate(alias, certificate)
    }
}

class VaultKeyPairGenerator : KeyPairGeneratorSpi() {

    private var asked: KeyGenParameterSpec? = null

    private var curve: String = DEFAULT_CURVE

    private var random: SecureRandom? = null

    override fun initialize(keysize: Int, random: SecureRandom?) {
        throw InvalidAlgorithmParameterException(
            "$NAME needs a KeyGenParameterSpec naming the alias, not a key size",
        )
    }

    override fun initialize(params: AlgorithmParameterSpec?, random: SecureRandom?) {
        val spec = params as? KeyGenParameterSpec
            ?: throw InvalidAlgorithmParameterException("$NAME needs a KeyGenParameterSpec, got $params")
        if (spec.keystoreAlias.isEmpty()) {
            throw InvalidAlgorithmParameterException("$NAME needs a non empty alias")
        }
        asked = spec
        curve = (spec.algorithmParameterSpec as? ECGenParameterSpec)?.name ?: DEFAULT_CURVE
        this.random = random
    }

    override fun generateKeyPair(): KeyPair {
        val spec = asked ?: throw IllegalStateException("$NAME generator was never initialized")
        val generator = KeyPairGenerator.getInstance("EC")
        val seed = random
        if (seed == null) generator.initialize(ECGenParameterSpec(curve))
        else generator.initialize(ECGenParameterSpec(curve), seed)
        val pair = generator.generateKeyPair()
        val leaf = LeafCertificate.of(pair, SUBJECT)
        KeyVault.current().put(spec.keystoreAlias, pair.private, null, arrayOf(leaf))
        if (spec.attestationChallenge != null) {
            PlatformHost.log(
                4,
                "KeyStore",
                "generated ${spec.keystoreAlias} on $curve; the chain is self signed, " +
                    "so the attestation challenge is recorded and not attested",
            )
        }
        return pair
    }

    private companion object {

        const val DEFAULT_CURVE = "secp256r1"

        const val NAME = AndroidKeyStoreProvider.NAME

        const val SUBJECT = "Android Keystore Key"
    }
}
