package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.utils.extractorLog
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** The block cipher work several player apis need to hand back a stream url.
 *
 * Every host here answers with the same shape: a body that is not json until it has been decoded
 * and decrypted, so keeping that step in one place is what lets each extractor stay a short class
 * that only knows its own endpoint and its own key. */

/** Decrypts an AES CBC body. Returns null rather than throwing, because a host rotating its key is
 * an ordinary event and must cost one dead extractor, not the whole link load. */
internal fun aesCbcDecrypt(body: ByteArray, key: ByteArray, iv: ByteArray): String? = try {
    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
    String(cipher.doFinal(body), Charsets.UTF_8)
} catch (t: Throwable) {
    extractorLog("aes decrypt failed: ${t::class.java.simpleName}: ${t.message}")
    null
}

/** Decrypts an AES GCM body whose authentication tag is the last 16 bytes, which is where every
 * browser crypto api puts it and therefore where every player that encrypts in the page puts it. */
internal fun aesGcmDecrypt(body: ByteArray, key: ByteArray, iv: ByteArray): String? = try {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
    String(cipher.doFinal(body), Charsets.UTF_8)
} catch (t: Throwable) {
    extractorLog("aes gcm decrypt failed: ${t::class.java.simpleName}: ${t.message}")
    null
}

private const val TAG_BITS = 128

/** A key the host writes shorter than the cipher wants, zero filled up to [size]. */
internal fun paddedKey(secret: String, size: Int): ByteArray =
    secret.toByteArray(Charsets.UTF_8).copyOf(size)

internal fun decodeHex(text: String): ByteArray? {
    val clean = text.trim().trim('"')
    if (clean.length < 32 || clean.length % 2 != 0) return null
    if (!clean.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) return null
    return try {
        ByteArray(clean.length / 2) { i ->
            ((Character.digit(clean[i * 2], 16) shl 4) + Character.digit(clean[i * 2 + 1], 16)).toByte()
        }
    } catch (t: Throwable) {
        null
    }
}

/** Base64 as the players write it: url safe alphabet, padding usually left off. */
internal fun decodeBase64Url(text: String): ByteArray? {
    val clean = text.trim().trim('"').replace('-', '+').replace('_', '/')
    if (clean.length < 8) return null
    val padded = clean + "=".repeat((4 - clean.length % 4) % 4)
    return try {
        Base64.getDecoder().decode(padded)
    } catch (t: Throwable) {
        null
    }
}
