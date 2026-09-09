package app.valentines.companion

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import app.valentines.companion.data.NotificationHelper
import app.valentines.companion.widget.WidgetRefreshWorker
import java.util.concurrent.TimeUnit

class ValentinesApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Channels must exist before any system-rendered FCM notification
        // push arrives (else it is silently dropped).
        NotificationHelper.ensureChannel(this)
        NotificationHelper.ensureSyncChannel(this)
        scheduleWidgetRefresh()
    }

    private fun scheduleWidgetRefresh() {
        val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "widget_refresh",
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}