package app.valentines.companion

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import app.valentines.companion.widget.WidgetRefreshWorker
import java.util.concurrent.TimeUnit

class ValentinesApp : Application() {
    override fun onCreate() {
        super.onCreate()
        scheduleWidgetRefresh()
    }

    private fun scheduleWidgetRefresh() {
        val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(30, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "widget_refresh",
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}