package harbor.compat.host

import java.io.ByteArrayInputStream
import java.math.BigInteger
import java.security.KeyPair
import java.security.SecureRandom
import java.security.Signature
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object LeafCertificate {

    private val ECDSA_SHA256 = byteArrayOf(0x2A, 0x86.toByte(), 0x48, 0xCE.toByte(), 0x3D, 0x04, 0x03, 0x02)

    private val COMMON_NAME = byteArrayOf(0x55, 0x04, 0x03)

    private const val TEN_YEARS = 10L * 365L * 24L * 60L * 60L * 1000L

    fun of(pair: KeyPair, subject: String): X509Certificate {
        val from = Date(System.currentTimeMillis() - 60_000L)
        val to = Date(from.time + TEN_YEARS)
        val algorithm = sequence(oid(ECDSA_SHA256))
        val name = sequence(set(sequence(oid(COMMON_NAME), utf8(subject))))
        val tbs = sequence(
            explicit(0, integer(BigInteger.valueOf(2L))),
            integer(serial()),
            algorithm,
            name,
            sequence(utcTime(from), utcTime(to)),
            name,
            pair.public.encoded,
        )
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(pair.private)
        signer.update(tbs)
        val der = sequence(tbs, algorithm, bitString(signer.sign()))
        val factory = CertificateFactory.getInstance("X.509")
        return factory.generateCertificate(ByteArrayInputStream(der)) as X509Certificate
    }

    private fun serial(): BigInteger {
        val bytes = ByteArray(8)
        SecureRandom().nextBytes(bytes)
        bytes[0] = (bytes[0].toInt() and 0x7F).toByte()
        return BigInteger(bytes).max(BigInteger.ONE)
    }

    private fun sequence(vararg parts: ByteArray): ByteArray = tagged(0x30, join(parts))

    private fun set(body: ByteArray): ByteArray = tagged(0x31, body)

    private fun explicit(number: Int, body: ByteArray): ByteArray = tagged(0xA0 or number, body)

    private fun oid(body: ByteArray): ByteArray = tagged(0x06, body)

    private fun integer(value: BigInteger): ByteArray = tagged(0x02, value.toByteArray())

    private fun bitString(body: ByteArray): ByteArray = tagged(0x03, join(arrayOf(byteArrayOf(0), body)))

    private fun utf8(text: String): ByteArray = tagged(0x0C, text.toByteArray(Charsets.UTF_8))

    private fun utcTime(at: Date): ByteArray {
        val format = SimpleDateFormat("yyMMddHHmmss'Z'", Locale.ROOT)
        format.timeZone = TimeZone.getTimeZone("UTC")
        return tagged(0x17, format.format(at).toByteArray(Charsets.US_ASCII))
    }

    private fun tagged(tag: Int, body: ByteArray): ByteArray {
        val length = length(body.size)
        val out = ByteArray(1 + length.size + body.size)
        out[0] = tag.toByte()
        System.arraycopy(length, 0, out, 1, length.size)
        System.arraycopy(body, 0, out, 1 + length.size, body.size)
        return out
    }

    private fun length(size: Int): ByteArray {
        if (size < 0x80) return byteArrayOf(size.toByte())
        var width = 0
        var rest = size
        while (rest > 0) {
            width++
            rest = rest ushr 8
        }
        val out = ByteArray(1 + width)
        out[0] = (0x80 or width).toByte()
        for (i in 0 until width) out[out.size - 1 - i] = ((size ushr (8 * i)) and 0xFF).toByte()
        return out
    }

    private fun join(parts: Array<out ByteArray>): ByteArray {
        var total = 0
        for (part in parts) total += part.size
        val out = ByteArray(total)
        var at = 0
        for (part in parts) {
            System.arraycopy(part, 0, out, at, part.size)
            at += part.size
        }
        return out
    }
}
