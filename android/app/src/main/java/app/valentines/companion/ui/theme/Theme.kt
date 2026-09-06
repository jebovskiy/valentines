package app.valentines.companion.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ValentinesColors = darkColorScheme(
    primary = AccentCoral,
    onPrimary = Color(0xFF2A0F0C),
    primaryContainer = AccentCoralDim,
    onPrimaryContainer = TextCream,
    secondary = AccentGold,
    onSecondary = Color(0xFF2A1A05),
    background = BgPage,
    onBackground = TextCream,
    surface = BgPanel,
    onSurface = TextCream,
    surfaceVariant = BgPanel2,
    onSurfaceVariant = TextMuted,
    outline = BgPanel3,
    error = AccentCoral,
)

@Composable
fun ValentinesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ValentinesColors,
        typography = Typography,
        content = content,
    )
}