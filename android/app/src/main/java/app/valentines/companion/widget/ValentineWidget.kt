package app.valentines.companion.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.glance.BitmapImageProvider
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontFamily
import androidx.glance.text.FontStyle
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.valentines.companion.data.valentinesStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

object WidgetKeys {
    val LAST_FROM = stringPreferencesKey("widget_from")
    val LAST_MESSAGE = stringPreferencesKey("widget_message")
    val LAST_TYPE = stringPreferencesKey("widget_type")
    val LAST_SENT_AT = longPreferencesKey("widget_sent_at")
    val LAST_PHOTO_URL = stringPreferencesKey("widget_photo_url")
}

data class WidgetData(
    val from: String?,
    val message: String?,
    val type: String?,
    val sentAt: Long?,
    val photoUrl: String?,
)

class ValentineWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.valentinesStore.data.first()
        val photoUrl = prefs[WidgetKeys.LAST_PHOTO_URL]
        val bitmap = if (photoUrl != null) downloadBitmap(photoUrl) else null
        val data = WidgetData(
            from = prefs[WidgetKeys.LAST_FROM],
            message = prefs[WidgetKeys.LAST_MESSAGE],
            type = prefs[WidgetKeys.LAST_TYPE],
            sentAt = prefs[WidgetKeys.LAST_SENT_AT],
            photoUrl = photoUrl,
        )
        provideContent {
            WidgetContent(data = data, photo = bitmap)
        }
    }

    private suspend fun downloadBitmap(url: String): Bitmap? = withContext(Dispatchers.IO) {
        try {
            val client = OkHttpClient()
            val request = Request.Builder().url(url).build()
            client.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext null
                val bytes = resp.body?.bytes() ?: return@withContext null

                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)

                var sample = 1
                val maxDim = 1024
                while (bounds.outWidth / sample > maxDim || bounds.outHeight / sample > maxDim) {
                    sample *= 2
                }

                val opts = if (sample > 1) BitmapFactory.Options().apply { inSampleSize = sample } else null
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
            }
        } catch (_: Exception) {
            null
        }
    }

    @Composable
    private fun WidgetContent(data: WidgetData, photo: Bitmap?) {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(Color(0xFF34172E))
                .cornerRadius(20.dp)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (photo != null) {
                Image(
                    modifier = GlanceModifier.fillMaxSize().cornerRadius(12.dp),
                    provider = BitmapImageProvider(photo),
                    contentDescription = "Фото валентинки",
                    contentScale = ContentScale.Crop,
                )
                return@Column
            }
            val emoji = when (data.type) {
                "heart_open" -> "💌"
                "sparkle" -> "✨"
                "moon" -> "🌙"
                "flame" -> "🔥"
                else -> "💌"
            }
            Text(
                text = emoji,
                style = TextStyle(fontSize = 26.sp),
            )
            Spacer(GlanceModifier.height(8.dp))
            if (data.from != null) {
                Text(
                    text = data.from,
                    style = TextStyle(
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Serif,
                        fontStyle = FontStyle.Italic,
                        color = ColorProvider(Color(0xFFFBEDE4)),
                    ),
                )
            }
            Spacer(GlanceModifier.height(2.dp))
            Text(
                text = data.message ?: "Новая валентинка",
                style = TextStyle(
                    fontSize = 11.sp,
                    color = ColorProvider(Color(0xFF8C6B7C)),
                ),
            )
        }
    }
}

class ValentineWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ValentineWidget()
}