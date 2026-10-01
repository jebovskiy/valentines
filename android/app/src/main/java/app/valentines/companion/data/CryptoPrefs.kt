package app.valentines.companion.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Wraps a secret key held in Android Keystore so tokens (device id, pair id)
 * are not stored in plaintext. Values written to DataStore are prefixed with
 * "enc:v1:" (Base64(iv + ciphertext)); legacy plaintext values decrypt to
 * themselves so existing installs keep working.
 */
object CryptoPrefs {
    private const val KEY_ALIAS = "valentines_prefs_master_key"
    private const val PREFIX = "enc:v1:"
    private const val IV_SIZE = 12
    private const val GCM_TAG_BITS = 128

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val iv = cipher.iv
        val blob = ByteArray(iv.size + ciphertext.size)
        iv.copyInto(blob, 0)
        ciphertext.copyInto(blob, iv.size)
        return PREFIX + Base64.getEncoder().encodeToString(blob)
    }

    /** Returns the plaintext, or null if the stored value cannot be decrypted. */
    fun decrypt(stored: String): String? {
        if (!stored.startsWith(PREFIX)) return stored // legacy plaintext
        val blob = runCatching { Base64.getDecoder().decode(stored.removePrefix(PREFIX)) }.getOrNull() ?: return null
        if (blob.size < IV_SIZE + GCM_TAG_BITS / 8) return null
        val iv = blob.copyOfRange(0, IV_SIZE)
        val ciphertext = blob.copyOfRange(IV_SIZE, blob.size)
        return runCatching {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        }.getOrNull()
    }
}