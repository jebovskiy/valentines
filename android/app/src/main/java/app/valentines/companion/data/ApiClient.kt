package app.valentines.companion.data

import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

data class CompletePairingRequest(
    @Json(name = "token") val token: String,
    @Json(name = "platform") val platform: String,
    @Json(name = "push_token") val pushToken: String,
)

data class CompletePairingResponse(
    @Json(name = "pairId") val pairId: String,
    @Json(name = "partnerTelegramId") val partnerTelegramId: Long,
    @Json(name = "partnerName") val partnerName: String?,
    @Json(name = "myName") val myName: String?,
    @Json(name = "deviceId") val deviceId: String,
)

data class DeviceStatusRequest(
    @Json(name = "device_id") val deviceId: String,
    @Json(name = "push_token") val pushToken: String? = null,
    @Json(name = "granted") val granted: Boolean? = null,
    @Json(name = "added") val added: Boolean? = null,
)

data class SimpleResponse(
    @Json(name = "success") val success: Boolean = false,
)

interface ValentinesApi {
    @POST("/api/pairs/pairing/complete")
    suspend fun completePairing(@Body body: CompletePairingRequest): CompletePairingResponse

    @POST("/api/companion/push-token")
    suspend fun updatePushToken(@Body body: DeviceStatusRequest): SimpleResponse

    @POST("/api/companion/permission")
    suspend fun updatePermission(@Body body: DeviceStatusRequest): SimpleResponse

    @POST("/api/companion/widget")
    suspend fun updateWidget(@Body body: DeviceStatusRequest): SimpleResponse
}

object ApiClient {
    private const val BASE_URL = "https://valentines-production-1fd5.up.railway.app"

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val okHttp = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
        .build()

    val api: ValentinesApi = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttp)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(ValentinesApi::class.java)
}