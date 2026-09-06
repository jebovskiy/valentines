package app.valentines.companion.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.store by preferencesDataStore(name = "valentines_prefs")

object Preferences {
    val DEVICE_ID = stringPreferencesKey("device_id")
    val PAIR_ID = stringPreferencesKey("pair_id")
    val PARTNER_NAME = stringPreferencesKey("partner_name")
    val MY_NAME = stringPreferencesKey("my_name")
    val PARTNER_TELEGRAM_ID = longPreferencesKey("partner_telegram_id")
    val WIDGET_ADDED = booleanPreferencesKey("widget_added")
    val PUSH_GRANTED = booleanPreferencesKey("push_granted")

    val LAST_FROM = stringPreferencesKey("widget_from")
    val LAST_MESSAGE = stringPreferencesKey("widget_message")
    val LAST_TYPE = stringPreferencesKey("widget_type")
    val LAST_SENT_AT = longPreferencesKey("widget_sent_at")
}

class PrefsRepository(private val context: Context) {

    val deviceId: Flow<String?> = context.store.data.map { it[Preferences.DEVICE_ID] }
    val hasDevice: Flow<Boolean> = context.store.data.map { it[Preferences.DEVICE_ID] != null }

    suspend fun savePair(
        deviceId: String,
        pairId: String,
        partnerTelegramId: Long,
        partnerName: String?,
        myName: String?
    ) {
        context.store.edit { prefs ->
            prefs[Preferences.DEVICE_ID] = deviceId
            prefs[Preferences.PAIR_ID] = pairId
            prefs[Preferences.PARTNER_TELEGRAM_ID] = partnerTelegramId
            putNullable(prefs, Preferences.PARTNER_NAME, partnerName)
            putNullable(prefs, Preferences.MY_NAME, myName)
        }
    }

    suspend fun setPushGranted(granted: Boolean) {
        context.store.edit { it[Preferences.PUSH_GRANTED] = granted }
    }

    suspend fun setWidgetAdded(added: Boolean) {
        context.store.edit { it[Preferences.WIDGET_ADDED] = added }
    }

    suspend fun getDeviceId(): String? = context.store.data.first()[Preferences.DEVICE_ID]

    suspend fun isPushGranted(): Boolean =
        context.store.data.first()[Preferences.PUSH_GRANTED] ?: false

    suspend fun isWidgetAdded(): Boolean =
        context.store.data.first()[Preferences.WIDGET_ADDED] ?: false

    suspend fun saveLastValentine(from: String, message: String?, type: String, sentAtMillis: Long) {
        context.store.edit { prefs ->
            prefs[Preferences.LAST_FROM] = from
            putNullable(prefs, Preferences.LAST_MESSAGE, message)
            prefs[Preferences.LAST_TYPE] = type
            prefs[Preferences.LAST_SENT_AT] = sentAtMillis
        }
    }

    private fun putNullable(prefs: androidx.datastore.preferences.core.MutablePreferences, key: androidx.datastore.preferences.core.Preferences.Key<String>, value: String?) {
        if (value != null) prefs[key] = value else prefs.remove(key)
    }

    val lastFrom: Flow<String?> = context.store.data.map { it[Preferences.LAST_FROM] }
    val lastMessage: Flow<String?> = context.store.data.map { it[Preferences.LAST_MESSAGE] }
    val lastType: Flow<String?> = context.store.data.map { it[Preferences.LAST_TYPE] }
    val lastSentAt: Flow<Long?> = context.store.data.map { it[Preferences.LAST_SENT_AT] }
    val partnerName: Flow<String?> = context.store.data.map { it[Preferences.PARTNER_NAME] }

    suspend fun isPairingComplete(): Boolean = deviceId.first() != null
}