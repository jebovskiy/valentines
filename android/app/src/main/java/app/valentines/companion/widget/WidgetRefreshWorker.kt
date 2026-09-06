package app.valentines.companion.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class WidgetRefreshWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Re-emit current widget state from DataStore (parked data already persisted)
        ValentineWidget().updateAll(applicationContext)
        return Result.success()
    }
}