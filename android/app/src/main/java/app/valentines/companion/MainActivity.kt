package app.valentines.companion

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.valentines.companion.ui.ValentinesAppScreen
import app.valentines.companion.ui.theme.ValentinesTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val initialToken = extractToken(intent?.data)

        setContent {
            ValentinesTheme {
                ValentinesAppScreen(initialToken = initialToken)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val token = extractToken(intent.data)
        if (token != null) {
            newPairToken(token)
        }
    }

    private fun newPairToken(token: String) {
        val broadcast = Intent()
            .setAction(ACTION_PAIR_TOKEN)
            .putExtra(EXTRA_TOKEN, token)
            .setPackage(packageName)
        sendBroadcast(broadcast)
    }

    private fun extractToken(uri: Uri?): String? {
        if (uri == null) return null
        return when (uri.scheme) {
            "valentines" -> uri.getQueryParameter("token")
            "https" -> uri.path?.removePrefix("/c/")
            else -> null
        }
    }

    companion object {
        const val ACTION_PAIR_TOKEN = "app.valentines.companion.PAIR_TOKEN"
        const val EXTRA_TOKEN = "pair_token"
    }
}