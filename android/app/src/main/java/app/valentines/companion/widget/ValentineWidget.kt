package app.valentines.companion.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontFamily
import androidx.glance.text.FontStyle
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.flow.first

private val Context.valentineDataStore by preferencesDataStore(name = "valentines_prefs")

object WidgetKeys {
    val LAST_FROM = stringPreferencesKey("widget_from")
    val LAST_MESSAGE = stringPreferencesKey("widget_message")
    val LAST_TYPE = stringPreferencesKey("widget_type")
    val LAST_SENT_AT = longPreferencesKey("widget_sent_at")
}

data class WidgetData(
    val from: String?,
    val message: String?,
    val type: String?,
    val sentAt: Long?,
)

class ValentineWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.valentineDataStore.data.first()
        val data = WidgetData(
            from = prefs[WidgetKeys.LAST_FROM],
            message = prefs[WidgetKeys.LAST_MESSAGE],
            type = prefs[WidgetKeys.LAST_TYPE],
            sentAt = prefs[WidgetKeys.LAST_SENT_AT],
        )
        provideContent {
            WidgetContent(data = data)
        }
    }

    @Composable
    private fun WidgetContent(data: WidgetData) {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(Color(0xFF34172E))
                .cornerRadius(20.dp)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
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