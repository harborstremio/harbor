package harbor.capstan.test

import android.security.keystore.KeyGenParameterSpec
import com.lagradost.cloudstream3.CloudStreamApp
import com.lagradost.cloudstream3.json
import com.lagradost.cloudstream3.utils.DataStore
import harbor.compat.host.AndroidKeyStoreProvider
import harbor.compat.host.PlatformHost
import java.io.File
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.cert.X509Certificate
import java.security.interfaces.ECPrivateKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import kotlinx.serialization.builtins.serializer

private const val ALIAS = "capstan_gate_signing_v1"

private const val CREDENTIAL = "CAPSTAN_GATE_INSTALL_ID"

private const val CANONICAL = "CAPSTAN-GATE-V1\nthe text both processes sign"

private val failures = ArrayList<String>()

private fun check(label: String, ok: Boolean, detail: Any? = null) {
    if (ok) println("  ok   $label") else {
        println("  FAIL $label ${detail ?: ""}")
        failures.add(label)
    }
}

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val phase = args.getOrNull(1) ?: "first"
    PlatformHost.dataDir = File(root, "out/keystore-gate-data")
    AndroidKeyStoreProvider.install()
    println("=== phase $phase, data ${PlatformHost.dataDir}")
    when (phase) {
        "first" -> first()
        "again" -> again(args.getOrNull(2).orEmpty(), args.getOrNull(3).orEmpty())
        else -> {
            System.err.println("unknown phase $phase")
            kotlin.system.exitProcess(2)
        }
    }
    println("KEYSTORE GATE $phase ${if (failures.isEmpty()) "ok" else "FAILED"}, ${failures.size} checks failed")
    if (failures.isNotEmpty()) kotlin.system.exitProcess(1)
}

private fun first() {
    PlatformHost.dataDir.deleteRecursively()
    val store = KeyStore.getInstance(AndroidKeyStoreProvider.NAME)
    check("KeyStore.getInstance(\"AndroidKeyStore\") answers", true, store.provider.name)
    store.load(null as KeyStore.LoadStoreParameter?)
    check("a fresh store holds no alias", !store.containsAlias(ALIAS))

    val generator = KeyPairGenerator.getInstance("EC", AndroidKeyStoreProvider.NAME)
    val challenge = ByteArray(32) { it.toByte() }
    val spec = KeyGenParameterSpec.Builder(ALIAS, KeyGenParameterSpec.PURPOSE_SIGN)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setDigests("SHA-256")
        .setUserAuthenticationRequired(false)
        .setAttestationChallenge(challenge)
        .build()
    generator.initialize(spec)
    val pair = generator.generateKeyPair()
    check("generateKeyPair returns a pair", pair.private != null && pair.public != null)
    check(
        "the curve the spec named is the curve generated",
        (pair.private as? ECPrivateKey)?.params?.curve?.field?.fieldSize == 256,
        (pair.private as? ECPrivateKey)?.params?.curve?.field?.fieldSize,
    )

    val second = KeyStore.getInstance(AndroidKeyStoreProvider.NAME)
    second.load(null as KeyStore.LoadStoreParameter?)
    check("the alias is there straight after generation", second.containsAlias(ALIAS))
    val chain = second.getCertificateChain(ALIAS)
    check("the store hands back a chain", chain != null && chain.isNotEmpty(), chain?.size)
    val leaf = chain?.firstOrNull() as? X509Certificate
    check("the leaf is an X.509 certificate", leaf != null)
    check("the leaf encodes", (leaf?.encoded?.size ?: 0) > 100, leaf?.encoded?.size)
    check("the leaf carries the subject a device uses", leaf?.subjectX500Principal?.name == "CN=Android Keystore Key", leaf?.subjectX500Principal?.name)
    runCatching { leaf?.verify(pair.public) }
        .onFailure { check("the leaf verifies against the generated key", false, it) }
        .onSuccess { check("the leaf verifies against the generated key", true) }

    val signature = sign(pair.private)
    check("the generated key signs", verify(pair.public, signature))

    CloudStreamApp.setKey(CREDENTIAL, "gate-installation-id")
    val readBack = storedTheWayAnArchiveReadsIt(CREDENTIAL)
    check("a credential written through setKey is where an inlined getKey looks", readBack == "gate-installation-id", readBack)

    println("LEAF_PUBLIC ${Base64.getEncoder().encodeToString(pair.public.encoded)}")
    println("INSTALL_ID ${readBack.orEmpty()}")
}

private fun again(expectedPublicKey: String, expectedId: String) {
    check("the first phase handed over a public key", expectedPublicKey.isNotEmpty())
    val store = KeyStore.getInstance(AndroidKeyStoreProvider.NAME)
    store.load(null as KeyStore.LoadStoreParameter?)
    check("the alias survived the process", store.containsAlias(ALIAS))
    val key = store.getKey(ALIAS, null) as? PrivateKey
    check("getKey(alias, null) returns a private key", key != null)
    val chain = store.getCertificateChain(ALIAS)
    check("the chain survived the process", chain != null && chain.isNotEmpty(), chain?.size)

    val recorded = runCatching {
        val bytes = Base64.getDecoder().decode(expectedPublicKey)
        java.security.KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(bytes))
    }.getOrNull()
    check("the recorded public key parses", recorded != null)
    if (key != null && recorded != null) {
        check("this process signs and the first process's key verifies it", verify(recorded, sign(key)))
    }
    val leaf = chain?.firstOrNull() as? X509Certificate
    check(
        "the stored leaf still carries that same public key",
        leaf != null && recorded != null && leaf.publicKey.encoded.contentEquals(recorded.encoded),
    )

    val readBack = storedTheWayAnArchiveReadsIt(CREDENTIAL)
    check("the credential survived the process", readBack == expectedId && expectedId.isNotEmpty(), readBack)
}

private fun sign(key: PrivateKey): ByteArray {
    val signer = Signature.getInstance("SHA256withECDSA")
    signer.initSign(key)
    signer.update(CANONICAL.toByteArray(Charsets.UTF_8))
    return signer.sign()
}

private fun verify(key: PublicKey, signature: ByteArray): Boolean = runCatching {
    val verifier = Signature.getInstance("SHA256withECDSA")
    verifier.initVerify(key)
    verifier.update(CANONICAL.toByteArray(Charsets.UTF_8))
    verifier.verify(signature)
}.getOrDefault(false)

private fun storedTheWayAnArchiveReadsIt(path: String): String? {
    val context = CloudStreamApp.context ?: return null
    val text = DataStore.getSharedPrefs(context).getString(path, null) ?: return null
    return runCatching { json.decodeFromString(String.serializer(), text) }.getOrNull()
}
