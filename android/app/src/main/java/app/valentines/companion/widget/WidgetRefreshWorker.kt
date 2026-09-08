package app.valentines.companion.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.valentines.companion.data.ApiClient
import app.valentines.companion.data.LatestValentineRequest
import app.valentines.companion.data.PrefsRepository

class WidgetRefreshWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        refreshWidgetData(applicationContext)
        return Result.success()
    }
}

data class WidgetRefreshResult(
    val valentineId: String?,
    val fromName: String?,
)

/**
 * Fetches the latest valentine from the backend, persists it for the widget
 * and re-renders every widget instance. Used by the periodic worker, the sync
 * service and on app foreground launch so the widget stays fresh instantly.
 * Returns what was persisted (null when there is no data and nothing saved).
 */
suspend fun refreshWidgetData(context: Context): WidgetRefreshResult? {
    var result: WidgetRefreshResult? = null
    val prefs = PrefsRepository(context)
    val deviceId = prefs.getDeviceId()
    if (deviceId != null) {
        try {
            val response = ApiClient.api.latestValentine(LatestValentineRequest(deviceId))
            val v = response.valentine
            if (v != null) {
                val sentAtMillis = runCatching {
                    v.sentAt?.let { java.time.OffsetDateTime.parse(it).toInstant().toEpochMilli() }
                }.getOrNull()
                prefs.saveLastValentine(
                    from = v.fromName ?: "Партнер",
                    message = v.message,
                    type = v.animationType ?: "heart_open",
                    sentAtMillis = sentAtMillis ?: System.currentTimeMillis(),
                    photoUrl = v.photoUrl,
                    valentineId = v.id,
                )
                result = WidgetRefreshResult(v.id, v.fromName)
            }
        } catch (_: Exception) {
            // offline / server down — keep parked data
        }
    }
    ValentineWidget().updateAll(context)
    return result
}