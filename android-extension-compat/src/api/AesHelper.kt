package com.lagradost.cloudstream3.extractors.helper

import com.lagradost.cloudstream3.extractors.jsonTree
import com.lagradost.cloudstream3.utils.extractorLog
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object AesHelper {

    suspend fun cryptoAESHandler(
        data: String,
        pass: ByteArray,
        encrypt: Boolean = true,
        padding: Boolean = true,
    ): String? = try {
        if (encrypt) seal(data, pass, padding) else open(data, pass, padding)
    } catch (t: Throwable) {
        extractorLog("aes envelope failed: ${t::class.java.simpleName}: ${t.message}")
        null
    }

    private fun open(data: String, pass: ByteArray, padding: Boolean): String? {
        val body = jsonTree(data) ?: return null
        val salt = hexToBytes(body.path("s").asText("")) ?: return null
        val cipherText = base64ToBytes(body.path("ct").asText("")) ?: return null
        val (key, derived) = deriveKeyAndIv(pass, salt)
        val declared = hexToBytes(body.path("iv").asText(""))
        val iv = if (declared != null && declared.size == IV_BYTES) declared else derived
        return String(cipher(Cipher.DECRYPT_MODE, key, iv, padding).doFinal(cipherText), Charsets.UTF_8)
    }

    private fun seal(data: String, pass: ByteArray, padding: Boolean): String {
        val salt = ByteArray(SALT_BYTES).also(SecureRandom()::nextBytes)
        val (key, iv) = deriveKeyAndIv(pass, salt)
        val sealed = cipher(Cipher.ENCRYPT_MODE, key, iv, padding).doFinal(data.toByteArray(Charsets.UTF_8))
        return """{"ct":"${Base64.getEncoder().encodeToString(sealed)}",""" +
            """"iv":"${bytesToHex(iv)}","s":"${bytesToHex(salt)}"}"""
    }

    private fun cipher(mode: Int, key: ByteArray, iv: ByteArray, padding: Boolean): Cipher {
        val name = if (padding) "AES/CBC/PKCS5PADDING" else "AES/CBC/NOPADDING"
        return Cipher.getInstance(name).apply {
            init(mode, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        }
    }

    private fun deriveKeyAndIv(pass: ByteArray, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val digest = MessageDigest.getInstance("MD5")
        var block = ByteArray(0)
        var material = ByteArray(0)
        while (material.size < KEY_BYTES + IV_BYTES) {
            digest.reset()
            digest.update(block)
            digest.update(pass)
            digest.update(salt)
            block = digest.digest()
            material += block
        }
        return material.copyOfRange(0, KEY_BYTES) to material.copyOfRange(KEY_BYTES, KEY_BYTES + IV_BYTES)
    }

    private fun hexToBytes(text: String): ByteArray? {
        val clean = text.trim()
        if (clean.isEmpty() || clean.length % 2 != 0) return null
        if (!clean.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) return null
        return ByteArray(clean.length / 2) { i ->
            ((Character.digit(clean[i * 2], 16) shl 4) + Character.digit(clean[i * 2 + 1], 16)).toByte()
        }
    }

    private fun bytesToHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02x".format(it) }

    private fun base64ToBytes(text: String): ByteArray? = try {
        Base64.getDecoder().decode(text.trim())
    } catch (t: Throwable) {
        null
    }

    private const val KEY_BYTES = 32
    private const val IV_BYTES = 16
    private const val SALT_BYTES = 8
}
