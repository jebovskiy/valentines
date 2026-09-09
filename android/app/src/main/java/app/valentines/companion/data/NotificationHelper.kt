package app.valentines.companion.data

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.valentines.companion.MainActivity
import app.valentines.companion.R

const val VALENTINES_CHANNEL_ID = "valentines_channel"

object NotificationHelper {

    private const val NOTIFICATION_ID = 1001
    private const val GREETING_NOTIFICATION_ID = 1003

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            VALENTINES_CHANNEL_ID,
            "Валентинки",
            NotificationManager.IMPORTANCE_DEFAULT,
        )
        channel.description = "Новые валентинки и подсказки про виджет"
        manager.createNotificationChannel(channel)
    }

    fun ensureSyncChannel(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                "widget_sync",
                "Синхронизация виджета",
                NotificationManager.IMPORTANCE_LOW,
            )
        )
    }

    fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /**
     * Shows "look at your widget" notification for a new valentine.
     * No-op if the same valentine was already notified about, permission
     * is missing, or no id was provided.
     */
    suspend fun notifyNewValentine(context: Context, valentineId: String?, fromName: String?): Boolean {
        if (valentineId == null) return false
        if (!canNotify(context)) return false

        val prefs = PrefsRepository(context)
        if (prefs.getLastNotifiedId() == valentineId) return false
        prefs.setLastNotifiedId(valentineId)

        ensureChannel(context)

        val title = if (fromName != null && fromName.isNotBlank()) "Валентинка от $fromName" else "Новая валентинка"
        val content = "Посмотри на свой виджет — там что-то новое 💌"
        val contentIntent = buildContentIntent(context, valentineId)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        }
        return true
    }

    /**
     * Shows a gentle "good morning"/"good night" notification when the partner
     * sent a greeting. Deduplicates to once per greeting type per calendar day.
     */
    suspend fun notifyGreeting(context: Context, fromName: String?, night: Boolean): Boolean {
        if (!canNotify(context)) return false

        val prefs = PrefsRepository(context)
        val typeKey = if (night) "night" else "morning"
        val today = java.time.LocalDate.now().toString()
        val dedupKey = "$today:$typeKey"
        if (prefs.getLastGreetingDate() == dedupKey) return false
        prefs.setLastGreetingDate(dedupKey)

        ensureChannel(context)

        val noun = if (night) "спокойной ночи" else "доброго утра"
        val emoji = if (night) "🌙" else "☀️"
        val title = if (night) "Спокойной ночи $emoji" else "Доброе утро $emoji"
        val content =
            fromName?.takeIf { it.isNotBlank() }?.let { "$it желает тебе $noun" }
                ?: "Партнёр желает тебе $noun"
        val contentIntent = buildContentIntent(context, if (night) "greeting_night" else "greeting_morning")

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(GREETING_NOTIFICATION_ID, notification)
        }
        return true
    }

    private fun buildContentIntent(context: Context, valentineId: String): PendingIntent {
        val deepLink = "https://t.me/pairvalentine_bot?startapp=v_$valentineId"
        val intent = runCatching {
            Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }.getOrNull()

        val target = intent ?: Intent(context, MainActivity::class.java)
        return PendingIntent.getActivity(
            context,
            0,
            target,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}