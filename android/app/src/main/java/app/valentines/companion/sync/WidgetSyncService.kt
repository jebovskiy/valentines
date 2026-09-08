package app.valentines.companion.sync

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import app.valentines.companion.MainActivity
import app.valentines.companion.R
import app.valentines.companion.data.ApiClient
import app.valentines.companion.data.NotificationHelper
import app.valentines.companion.data.PrefsRepository
import app.valentines.companion.widget.refreshWidgetData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Keeps a long-lived stream connection to the backend and re-renders the
 * widget (plus shows a "look at your widget" notification) the moment a new
 * valentine arrives. This is the reliable real-time channel, independent of
 * FCM push reliability and of the notification permission.
 */
class WidgetSyncService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val running = AtomicBoolean(true)
    private var connectJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
        if (connectJob?.isActive != true) {
            connectJob = scope.launch { runLoop() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        connectJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private suspend fun runLoop() {
        val prefs = PrefsRepository(this)
        while (running.get()) {
            try {
                val deviceId = prefs.getDeviceId()
                if (deviceId == null) {
                    delay(RECONNECT_DELAY_MS)
                    continue
                }
                stream(deviceId)
            } catch (_: Exception) {
                // network error / stream closed — reconnect shortly
            }
            if (running.get()) delay(RECONNECT_DELAY_MS)
        }
    }

    private suspend fun stream(deviceId: String) {
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS) // streaming: never time out reads
            .build()
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/companion/stream?device_id=$deviceId")
            .header("Accept", "text/event-stream")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful || response.body == null) return
            val source = response.body!!.source()
            while (running.get()) {
                val line = source.readUtf8Line() ?: break
                if (line.startsWith("event: valentine")) {
                    // The following line is the payload: data: {"id": "..."}
                    val dataLine = source.readUtf8Line() ?: break
                    if (dataLine.startsWith("data: ")) {
                        val id = runCatching {
                            val json = dataLine.removePrefix("data: ")
                            org.json.JSONObject(json).optString("id")
                        }.getOrNull()
                        onValentine(id)
                    }
                }
            }
        }
    }

    private suspend fun onValentine(id: String?) {
        if (id == null) return
        val result = refreshWidgetData(this)
        NotificationHelper.notifyNewValentine(this, id, result?.fromName)
    }

    private fun createChannels() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                SYNC_CHANNEL_ID,
                "Синхронизация виджета",
                NotificationManager.IMPORTANCE_LOW,
            )
        )
    }

    private fun buildForegroundNotification() = runBlocking {
        val hasDevice = PrefsRepository(this@WidgetSyncService).getDeviceId() != null
        val text = if (hasDevice) "Виджет синхронизирован" else "Ожидание пары"
        val intent = PendingIntent.getActivity(
            this@WidgetSyncService,
            1,
            Intent(this@WidgetSyncService, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        NotificationCompat.Builder(this@WidgetSyncService, SYNC_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Валентинки")
            .setContentText(text)
            .setContentIntent(intent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private companion object {
        const val NOTIFICATION_ID = 1002
        const val SYNC_CHANNEL_ID = "widget_sync"
        const val RECONNECT_DELAY_MS = 10_000L
    }
}