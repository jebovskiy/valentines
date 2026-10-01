package app.valentines.companion.fcm

import android.annotation.SuppressLint
import app.valentines.companion.data.NotificationHelper
import app.valentines.companion.data.PrefsRepository
import app.valentines.companion.widget.ValentineWidget
import androidx.glance.appwidget.updateAll
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ValentinesMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        scope.launch {
            val prefs = PrefsRepository(this@ValentinesMessagingService)
            val deviceId = prefs.getDeviceId() ?: return@launch
            try {
                app.valentines.companion.data.ApiClient.api.updatePushToken(
                    app.valentines.companion.data.DeviceStatusRequest(
                        deviceId = deviceId,
                        pushToken = token,
                    )
                )
            } catch (_: Exception) {
            }
        }
    }

    // Delivers async to avoid blocking the main thread (runBlocking).
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        @SuppressLint({"WakelockTimeout"})
        val task = goAsync()
        scope.launch {
            try {
                handleMessage(message)
            } finally {
                task.finish()
            }
        }
    }

    private suspend fun handleMessage(message: RemoteMessage) {
        val data = message.data
        val context = this

        when (data["event"]) {
            "reminder" -> NotificationHelper.notifyReminder(
                context = context,
                title = data["title"],
                message = data["message"],
            )
            "greeting" -> NotificationHelper.notifyGreeting(
                context = context,
                fromName = data["from_name"],
                type = data["greeting_type"],
            )
            "note" -> NotificationHelper.notifyNote(
                context = context,
                senderName = data["from_name"],
                category = data["category"],
                content = data["content"],
            )
            "event" -> NotificationHelper.notifyEvent(
                context = context,
                name = data["name"],
                eventDate = data["event_date"],
                remindDaysBefore = data["remind_days_before"],
            )
            "update" -> NotificationHelper.notifyUpdate(
                context = context,
                version = data["version"],
            )
            "streak" -> NotificationHelper.notifyStreak(
                context = context,
                count = data["count"],
            )
            "movie" -> NotificationHelper.notifyMovie(
                context = context,
                title = data["title"],
                message = data["message"],
            )
            else -> handleValentine(data)
        }
    }

    private suspend fun handleValentine(data: Map<String, String>) {
        val valentineId = data["valentine_id"]
        val fromName = data["from_name"] ?: return
        val animationType = data["animation_type"]
        val messageText = data["message"]
        val sentAt = data["sent_at"]
        val photoUrl = data["photo_url"]

        // Persist latest valentine for the widget (off the main thread).
        val prefs = PrefsRepository(this)
        val sentAtMillis = runCatching { sentAt?.let { java.time.OffsetDateTime.parse(it).toInstant().toEpochMilli() } }.getOrNull()
        prefs.saveLastValentine(
            from = fromName,
            message = messageText,
            type = animationType ?: "heart_open",
            sentAtMillis = sentAtMillis ?: System.currentTimeMillis(),
            photoUrl = photoUrl,
            valentineId = valentineId,
        )

        // Update all widget instances with the latest valentine
        ValentineWidget().updateAll(this)

        // Prompt to look at the fresh widget
        NotificationHelper.notifyNewValentine(
            context = this,
            valentineId = valentineId,
            fromName = fromName,
        )
    }
}