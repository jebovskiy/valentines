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
    private const val REMINDER_NOTIFICATION_ID = 1005
    private const val NOTE_NOTIFICATION_ID = 1007
    private const val EVENT_NOTIFICATION_ID = 1009
    private const val UPDATE_NOTIFICATION_ID = 1011
    private const val STREAK_NOTIFICATION_ID = 1013
    private const val MOVIE_NOTIFICATION_ID = 1015

    private data class GreetingTheme(
        val title: String,
        val receivedValue: String,
        val receivedDefault: String,
    )

    private val GREETING_THEMES: Map<String, GreetingTheme> = mapOf(
        "morning" to GreetingTheme(
            title = "Доброе утро ☀️",
            receivedValue = "желает тебе доброго утра ☀️",
            receivedDefault = "Партнёр желает тебе доброго утра ☀️",
        ),
        "night" to GreetingTheme(
            title = "Спокойной ночи 🌙",
            receivedValue = "желает тебе спокойной ночи 🌙",
            receivedDefault = "Партнёр желает тебе спокойной ночи 🌙",
        ),
        "luck" to GreetingTheme(
            title = "Удачи 🍀",
            receivedValue = "желает тебе удачи 🍀",
            receivedDefault = "Партнёр желает тебе удачи 🍀",
        ),
        "day" to GreetingTheme(
            title = "Хорошего дня 🌞",
            receivedValue = "желает тебе хорошего дня 🌞",
            receivedDefault = "Партнёр желает тебе хорошего дня 🌞",
        ),
        "evening" to GreetingTheme(
            title = "Хорошего вечера 🌆",
            receivedValue = "желает тебе хорошего вечера 🌆",
            receivedDefault = "Партнёр желает тебе хорошего вечера 🌆",
        ),
        "care" to GreetingTheme(
            title = "Береги себя 🤗",
            receivedValue = "просит тебя беречь себя 🤗",
            receivedDefault = "Партнёр просит тебя беречь себя 🤗",
        ),
    )

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        // Upgrade path: if the channel was created with a lower importance in a
        // previous version, Android won't change it — recreate it so heads-up
        // (popup) notifications work for existing installs too.
        val existing = manager.getNotificationChannel(VALENTINES_CHANNEL_ID)
        if (existing != null && existing.importance < NotificationManager.IMPORTANCE_HIGH) {
            manager.deleteNotificationChannel(VALENTINES_CHANNEL_ID)
        }
        val channel = NotificationChannel(
            VALENTINES_CHANNEL_ID,
            "Валентинки",
            NotificationManager.IMPORTANCE_HIGH,
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
 * Shows a "good morning"/"good night"/"good luck"/etc. notification when the
 * partner sent a greeting. Deduplicates to once per greeting type per calendar
 * day.
 */
suspend fun notifyGreeting(context: Context, fromName: String?, type: String?): Boolean {
    if (!canNotify(context)) return false

    val prefs = PrefsRepository(context)
    val typeKey = type ?: "morning"
    val today = java.time.LocalDate.now().toString()
    val dedupKey = "$today:$typeKey"
    if (prefs.getLastGreetingDate() == dedupKey) return false
    prefs.setLastGreetingDate(dedupKey)

    ensureChannel(context)

    val theme = GREETING_THEMES[typeKey] ?: GREETING_THEMES["morning"]!!
    val content =
        fromName?.takeIf { it.isNotBlank() }?.let { "$it ${theme.receivedValue}" }
            ?: theme.receivedDefault
    val contentIntent = buildContentIntent(context, "greeting_$typeKey")

    val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(theme.title)
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

    /**
     * Shows a reminder notification ("⏰ title") for scheduled couple reminders.
     * Rendered locally in onMessageReceived so it pops up both in the foreground
     * and background.
     */
    suspend fun notifyReminder(context: Context, title: String?, message: String?): Boolean {
        if (!canNotify(context)) return false

        ensureChannel(context)

        val body = message?.takeIf { it.isNotBlank() } ?: "Запланированное напоминание для вас двоих"
        val contentIntent = buildContentIntent(context, "reminder")

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title?.takeIf { it.isNotBlank() } ?: "⏰ Напоминание")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(REMINDER_NOTIFICATION_ID, notification)
        }
        return true
    }

    suspend fun notifyNote(context: Context, senderName: String?, category: String?, content: String?): Boolean {
        if (!canNotify(context)) return false

        ensureChannel(context)

        val categoryLabel = when (category?.takeIf { it.isNotBlank() }) {
            "idea" -> "Идея"
            "todo" -> "Задача"
            "memory" -> "Воспоминание"
            "wish" -> "Мечта"
            else -> "Заметка"
        }
        val title = senderName?.takeIf { it.isNotBlank() }?.let { "📝 $categoryLabel от $it" } ?: "📝 Новая $categoryLabel"
        val body = content?.takeIf { it.isNotBlank() } ?: "Партнёр оставил тебе заметку"
        val contentIntent = buildOpenAppIntent(context)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(NOTE_NOTIFICATION_ID, notification)
        }
        return true
    }

    suspend fun notifyEvent(context: Context, name: String?, eventDate: String?, remindDaysBefore: String?): Boolean {
        if (!canNotify(context)) return false
        if (name.isNullOrBlank()) return false

        ensureChannel(context)

        val dateLabel = runCatching {
            java.time.LocalDate.parse(eventDate).format(java.time.format.DateTimeFormatter.ofPattern("d MMMM"))
        }.getOrDefault(eventDate ?: "")
        val via = when (remindDaysBefore) {
            "0" -> "сегодня"
            "1" -> "завтра"
            else -> "через $remindDaysBefore дн." 
        }
        val title = "📅 $name"
        val body = "$via · $dateLabel"
        val contentIntent = buildOpenAppIntent(context)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(EVENT_NOTIFICATION_ID, notification)
        }
        return true
    }

    suspend fun notifyUpdate(context: Context, version: String?): Boolean {
        if (!canNotify(context)) return false

        ensureChannel(context)

        val title = "Доступна новая версия Компаньона"
        val body = "Вышло обновление (${version ?: "новая сборка"}). Открой приложение, чтобы установить."
        val contentIntent = buildOpenAppIntent(context)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(UPDATE_NOTIFICATION_ID, notification)
        }
        return true
    }

    suspend fun notifyStreak(context: Context, count: String?): Boolean {
        val days = count?.toIntOrNull()
        if (days == null || days <= 0) return false
        if (!canNotify(context)) return false

        ensureChannel(context)

        val emoji = when {
            days >= 30 -> "🔥"
            days >= 7 -> "✨"
            days >= 3 -> "🎉"
            else -> "💪"
        }
        val title = "$emoji Стрик: $days дн. подряд"
        val body = "Вы с партнёром обмениваетесь валентинками $days дней подряд! Продолжайте в том же духе."
        val contentIntent = buildOpenAppIntent(context)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(STREAK_NOTIFICATION_ID, notification)
        }
        return true
    }

    suspend fun notifyMovie(context: Context, title: String?, message: String?): Boolean {
        if (!canNotify(context)) return false

        ensureChannel(context)

        val head = title?.takeIf { it.isNotBlank() } ?: "🎬 Фильмы"
        val body = message?.takeIf { it.isNotBlank() } ?: "Партнёр добавил фильм в список"
        val contentIntent = buildOpenAppIntent(context)

        val notification = NotificationCompat.Builder(context, VALENTINES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(head)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(MOVIE_NOTIFICATION_ID, notification)
        }
        return true
    }

    private fun buildOpenAppIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(
            context,
            1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
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