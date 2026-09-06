package app.valentines.companion.fcm

import app.valentines.companion.data.PrefsRepository
import app.valentines.companion.widget.ValentineWidget
import androidx.glance.appwidget.updateAll
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.runBlocking

class ValentinesMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        runBlocking {
            val prefs = PrefsRepository(this@ValentinesMessagingService)
            val deviceId = prefs.getDeviceId() ?: return@runBlocking
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

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val fromName = data["from_name"]
        val animationType = data["animation_type"]
        val messageText = data["message"]
        val sentAt = data["sent_at"]

        runBlocking {
            // Persist latest valentine for the widget
            val prefs = PrefsRepository(this@ValentinesMessagingService)
            if (fromName != null) {
                val sentAtMillis = runCatching { sentAt?.let { java.time.OffsetDateTime.parse(it).toInstant().toEpochMilli() } }.getOrNull()
                prefs.saveLastValentine(
                    from = fromName,
                    message = messageText,
                    type = animationType ?: "heart_open",
                    sentAtMillis = sentAtMillis ?: System.currentTimeMillis(),
                )
            }

            // Update all widget instances with the latest valentine
            ValentineWidget().updateAll(this@ValentinesMessagingService)
        }
    }
}