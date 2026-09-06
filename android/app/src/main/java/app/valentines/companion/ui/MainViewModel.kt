package app.valentines.companion.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.valentines.companion.data.ApiClient
import app.valentines.companion.data.CompletePairingRequest
import app.valentines.companion.data.DeviceStatusRequest
import app.valentines.companion.data.PrefsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import retrofit2.HttpException

sealed interface PairingState {
    data object Idle : PairingState
    data object Loading : PairingState
    data class Error(val message: String) : PairingState
    data class Paired(
        val deviceId: String,
        val partnerName: String?,
    ) : PairingState
    data object CompletedAll : PairingState
}

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = PrefsRepository(application)
    private val _state = MutableStateFlow<PairingState>(PairingState.Idle)
    val state: StateFlow<PairingState> = _state.asStateFlow()

    private val _bootLoading = MutableStateFlow(true)
    val bootLoading: StateFlow<Boolean> = _bootLoading.asStateFlow()

    init {
        checkExistingPairing()
    }

    private fun checkExistingPairing() {
        viewModelScope.launch {
            val hasDevice = prefs.deviceId.first() != null
            val granted = prefs.isPushGranted()
            val widget = prefs.isWidgetAdded()
            _bootLoading.value = false
            if (hasDevice) {
                _state.value = if (granted && widget) PairingState.CompletedAll else PairingState.Paired(
                    deviceId = prefs.getDeviceId().orEmpty(),
                    partnerName = prefs.partnerName.first(),
                )
            }
        }
    }

    fun startPairing(token: String) {
        viewModelScope.launch {
            _state.value = PairingState.Loading
            try {
                val response = ApiClient.api.completePairing(
                    CompletePairingRequest(
                        token = token,
                        platform = "android",
                        pushToken = "pending",
                    )
                )
                prefs.savePair(
                    deviceId = response.deviceId,
                    pairId = response.pairId,
                    partnerTelegramId = response.partnerTelegramId,
                    partnerName = response.partnerName,
                    myName = response.myName,
                )
                _state.value = PairingState.Paired(
                    deviceId = response.deviceId,
                    partnerName = response.partnerName,
                )
            } catch (e: HttpException) {
                _state.value = PairingState.Error("Неверная или истёкшая ссылка. Откройте её заново из Telegram.")
            } catch (e: Exception) {
                _state.value = PairingState.Error("Не удалось связаться с сервером. Попробуйте ещё раз.")
            }
        }
    }

    fun confirmPushPermission(granted: Boolean) {
        val state = _state.value as? PairingState.Paired ?: return
        viewModelScope.launch {
            try {
                if (granted) {
                    val token = com.google.firebase.messaging.FirebaseMessaging.getInstance().token.await()
                    ApiClient.api.updatePushToken(
                        DeviceStatusRequest(deviceId = state.deviceId, pushToken = token)
                    )
                }
                ApiClient.api.updatePermission(
                    DeviceStatusRequest(deviceId = state.deviceId, granted = granted)
                )
                prefs.setPushGranted(granted)
            } catch (_: Exception) {
            }
        }
    }

    fun confirmWidgetAdded(added: Boolean) {
        val state = _state.value as? PairingState.Paired ?: return
        viewModelScope.launch {
            try {
                ApiClient.api.updateWidget(
                    DeviceStatusRequest(deviceId = state.deviceId, added = added)
                )
                prefs.setWidgetAdded(added)
            } catch (_: Exception) {
            }
            _state.value = PairingState.CompletedAll
        }
    }
}