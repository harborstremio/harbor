package android.security.keystore

import java.security.spec.AlgorithmParameterSpec

class KeyGenParameterSpec internal constructor(
    val keystoreAlias: String,
    val purposes: Int,
    val digests: Array<String>,
    val algorithmParameterSpec: AlgorithmParameterSpec?,
    val attestationChallenge: ByteArray?,
    val isStrongBoxBacked: Boolean,
    val isUserAuthenticationRequired: Boolean,
) : AlgorithmParameterSpec {

    class Builder(private val keystoreAlias: String, private val purposes: Int) {

        private var digests: Array<String> = emptyArray()
        private var parameterSpec: AlgorithmParameterSpec? = null
        private var challenge: ByteArray? = null
        private var strongBox: Boolean = false
        private var userAuthentication: Boolean = false

        fun setDigests(vararg digests: String): Builder {
            this.digests = arrayOf(*digests)
            return this
        }

        fun setAlgorithmParameterSpec(spec: AlgorithmParameterSpec): Builder {
            parameterSpec = spec
            return this
        }

        fun setAttestationChallenge(attestationChallenge: ByteArray?): Builder {
            challenge = attestationChallenge?.copyOf()
            return this
        }

        fun setIsStrongBoxBacked(isStrongBoxBacked: Boolean): Builder {
            strongBox = isStrongBoxBacked
            return this
        }

        fun setUserAuthenticationRequired(required: Boolean): Builder {
            userAuthentication = required
            return this
        }

        fun build(): KeyGenParameterSpec = KeyGenParameterSpec(
            keystoreAlias,
            purposes,
            digests,
            parameterSpec,
            challenge,
            strongBox,
            userAuthentication,
        )
    }

    companion object {
        const val PURPOSE_ENCRYPT: Int = 1
        const val PURPOSE_DECRYPT: Int = 2
        const val PURPOSE_SIGN: Int = 4
        const val PURPOSE_VERIFY: Int = 8
    }
}
