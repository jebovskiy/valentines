package app.valentines.companion.data

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit

object UpdateInstaller {

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    suspend fun download(url: String, context: Context): File? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(url).build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body ?: return@withContext null
                val file = File(context.cacheDir, "update.apk")
                body.byteStream().use { input ->
                    file.outputStream().use { output -> input.copyTo(output) }
                }
                if (file.length() > 0) file else null
            }
        } catch (_: Exception) {
            null
        }
    }

    fun canRequestInstalls(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }

    fun openInstallSettings(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    /**
     * Verifies that the downloaded APK is signed with the SAME certificate as
     * the currently installed app. Prevents installing a tampered or
     * maliciously re-signed update. Returns false if it can't be verified.
     */
    fun isTrustedUpdate(context: Context, apk: File): Boolean = try {
        val updater = context.packageManager

        val archiveInfo = updater.getPackageArchiveInfo(apk.absolutePath, PackageManager.GET_SIGNATURES)
            ?: return false

        val apkSignatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            archiveInfo.signingInfo?.apkContentsSigners
        } else {
            archiveInfo.signatures
        } ?: return false

        val installedSignatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            updater.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                .signingInfo?.apkContentsSigners
        } else {
            updater.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES).signatures
        } ?: return false

        val apkCerts = apkSignatures.map { toX509(it.toByteArray()) }
        val installedCerts = installedSignatures.map { toX509(it.toByteArray()) }

        // The update must be signed by exactly the same set of certificates.
        apkCerts.isNotEmpty() &&
            apkCerts.size == installedCerts.size &&
            apkCerts.zip(installedCerts).all { (a, b) -> a.encoded.contentEquals(b.encoded) }
    } catch (_: Exception) {
        false
    }

    private fun toX509(der: ByteArray): X509Certificate =
        CertificateFactory.getInstance("X.509").generateCertificate(der.inputStream()) as X509Certificate
}