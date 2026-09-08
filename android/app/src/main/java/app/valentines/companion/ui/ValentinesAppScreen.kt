package app.valentines.companion.ui

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import app.valentines.companion.MainActivity
import app.valentines.companion.widget.ValentineWidget
import app.valentines.companion.ui.theme.AccentAndroid
import app.valentines.companion.ui.theme.AccentCoral
import app.valentines.companion.ui.theme.AccentCoralDim
import app.valentines.companion.ui.theme.BgPanel2
import app.valentines.companion.ui.theme.BgPanel3
import app.valentines.companion.ui.theme.TextCream
import app.valentines.companion.ui.theme.TextFaint
import app.valentines.companion.ui.theme.TextMuted

@Composable
fun ValentinesAppScreen(
    initialToken: String?,
    viewModel: MainViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()
    val bootLoading by viewModel.bootLoading.collectAsState()

    var currentToken by remember { mutableStateOf(initialToken) }

    val context = LocalContext.current
    DisposableEffect(Unit) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val token = intent.getStringExtra(MainActivity.EXTRA_TOKEN)
                if (token != null) currentToken = token
            }
        }
        val filter = IntentFilter(MainActivity.ACTION_PAIR_TOKEN)
        val flags = if (Build.VERSION.SDK_INT >= 33) {
            ContextCompat.RECEIVER_NOT_EXPORTED
        } else {
            0
        }
        context.registerReceiver(receiver, filter, flags)
        onDispose {
            context.unregisterReceiver(receiver)
        }
    }

    LaunchedEffect(currentToken) {
        if (currentToken != null) viewModel.startPairing(currentToken!!)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when {
            bootLoading -> {}
            state is PairingState.CompletedAll -> SetupDoneScreen(
                pushEnabled = viewModel.pushGranted.collectAsState().value,
                onTogglePush = viewModel::setPushEnabled,
            )
            state is PairingState.Paired -> {
                val paired = state as PairingState.Paired
                var pushStep by remember { mutableStateOf(false) }
                OnboardingFlow(
                    partnerName = paired.partnerName,
                    onPushResult = { granted ->
                        viewModel.confirmPushPermission(granted)
                        pushStep = true
                    },
                    onWidgetDone = { added ->
                        viewModel.confirmWidgetAdded(added)
                    },
                )
            }
            state is PairingState.Loading -> PairingLoadingScreen()
            state is PairingState.Error -> {
                PairingErrorScreen((state as PairingState.Error).message)
            }
            currentToken != null && state is PairingState.Idle -> PairingLoadingScreen()
            else -> {
                if (currentToken == null && state is PairingState.Idle) {
                    NoTokenScreen()
                }
            }
        }

        UpdateDialog(
            updateAvailable = viewModel.updateAvailable.collectAsState().value,
            installing = viewModel.updateInstalling.collectAsState().value,
            failed = viewModel.updateFailed.collectAsState().value,
            onInstall = viewModel::startUpdate,
            onDismiss = viewModel::dismissUpdate,
        )
    }
}

@Composable
private fun UpdateDialog(
    updateAvailable: app.valentines.companion.data.UpdateInfo?,
    installing: Boolean,
    failed: Boolean,
    onInstall: () -> Unit,
    onDismiss: () -> Unit,
) {
    val info = updateAvailable ?: return
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1119),
        titleContentColor = TextCream,
        textContentColor = TextMuted,
        title = { Text("Доступно обновление", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) },
        text = {
            if (failed) {
                Column {
                    Text("Не удалось скачать файл.Проверьте интернет.")
                    Spacer(Modifier.height(14.dp))
                    Text("Версия ${info.versionName ?: "v" + info.versionCode}, можно попробовать ещё раз.", fontSize = 12.sp)
                }
            } else {
                Column {
                    Text("Вышла новая версия ${info.versionName ?: "v" + info.versionCode}. Обновитесь, чтобы получать валентинки и улучшения.")
                    if (installing) {
                        Spacer(Modifier.height(18.dp))
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        Text("Скачивание…", fontSize = 12.sp, color = TextFaint)
                    }
                }
            }
        },
        confirmButton = {
            if (installing) {
                TextButton(onClick = {}) { Text("Скачивание…", color = TextFaint) }
            } else {
                Button(
                    onClick = onInstall,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentCoral,
                        contentColor = Color(0xFF2A0F0C),
                    ),
                ) { Text("Обновить", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
            }
        },
        dismissButton = {
            if (!installing) {
                TextButton(onClick = onDismiss) { Text("Позже", color = TextFaint) }
            }
        },
    )
}

@Composable
private fun OnboardingFlow(
    partnerName: String?,
    onPushResult: (Boolean) -> Unit,
    onWidgetDone: (Boolean) -> Unit,
) {
    var step by remember { mutableStateOf(0) }

    when (step) {
        0 -> PushPermissionScreen(partnerName = partnerName) { granted ->
            onPushResult(granted)
            step = 1
        }
        else -> WidgetPinScreen(partnerName = partnerName) { added ->
            onWidgetDone(added)
        }
    }
}

@Composable
private fun StepHeader(title: String, sub: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(6.dp))
        Text(
            sub,
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
        )
    }
}

@Composable
private fun BigHeartIcon() {
    val transition = rememberInfiniteTransition(label = "pulse")
    val pulse by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1300, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseScale",
    )
    Box(
        modifier = Modifier
            .size(72.dp)
            .scale(pulse)
            .background(
                brush = androidx.compose.ui.graphics.Brush.linearGradient(
                    colors = listOf(Color(0xFFFF9A8C), AccentCoralDim),
                ),
                shape = RoundedCornerShape(22.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text("💌", fontSize = 32.sp)
    }
}

@Composable
private fun PairingLoadingScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BigHeartIcon()
        Spacer(Modifier.height(24.dp))
        Text("Связываем с Telegram", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(10.dp))
        Text(
            "Подтверждаем пару — секунда",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
        )
        Spacer(Modifier.height(24.dp))
        LoadingSpinner()
    }
}

@Composable
private fun LoadingSpinner() {
    val transition = rememberInfiniteTransition(label = "spin")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "spinAngle",
    )
    Box(
        modifier = Modifier
            .size(24.dp)
            .graphicsLayer { rotationZ = angle }
            .background(
                color = Color.Transparent,
                shape = CircleShape,
            )
            .then(Modifier),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.Canvas(Modifier.size(24.dp)) {
            val stroke = 2.5.dp.toPx()
            drawCircle(
                color = Color.White.copy(alpha = 0.15f),
                style = androidx.compose.ui.graphics.drawscope.Stroke(stroke),
            )
            drawArc(
                color = AccentCoral,
                startAngle = angle,
                sweepAngle = 120f,
                useCenter = false,
                style = androidx.compose.ui.graphics.drawscope.Stroke(stroke),
            )
        }
    }
}

@Composable
private fun PairingErrorScreen(message: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("⚠️", fontSize = 40.sp)
        Spacer(Modifier.height(16.dp))
        Text("Не получилось", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(10.dp))
        Text(
            message,
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            modifier = Modifier.width(260.dp),
        )
    }
}

@Composable
private fun NoTokenScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BigHeartIcon()
        Spacer(Modifier.height(24.dp))
        Text("Валентинки", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(10.dp))
        Text(
            "Откройте ссылку из Telegram, чтобы настроить виджет.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            modifier = Modifier.width(260.dp),
        )
    }
}

@Composable
private fun PushPermissionScreen(
    partnerName: String?,
    onResult: (Boolean) -> Unit,
) {
    val context = LocalContext.current
    var showSheet by remember { mutableStateOf(true) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> onResult(granted) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        StepHeader(
            title = "Готово, вы в паре с ${partnerName ?: "партнёром"}",
            sub = "Осталось разрешить уведомления — без них виджет не узнает о новой валентинке",
        )
        Spacer(Modifier.height(24.dp))
        Text("🔔", fontSize = 40.sp)

        PermissionSheet(
            visible = showSheet,
            onAllow = {
                showSheet = false
                if (Build.VERSION.SDK_INT >= 33) {
                    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    if (granted) onResult(true) else permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    onResult(true)
                }
            },
            onDeny = {
                showSheet = false
                onResult(false)
            },
        )
    }
}

@Composable
private fun PermissionSheet(
    visible: Boolean,
    onAllow: () -> Unit,
    onDeny: () -> Unit,
) {
    AnimatedVisibility(visible = visible) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1E1119), RoundedCornerShape(20.dp))
                    .padding(18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("🔔", fontSize = 24.sp)
                Spacer(Modifier.height(10.dp))
                Text(
                    "Разрешить уведомления?",
                    style = MaterialTheme.typography.titleLarge,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Приложение хочет присылать вам уведомления о новых валентинках",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextMuted,
                    modifier = Modifier.width(250.dp),
                )
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = onDeny,
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Transparent,
                        contentColor = TextFaint,
                    ),
                ) { Text("Не разрешать") }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onAllow,
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentCoral,
                        contentColor = Color(0xFF2A0F0C),
                    ),
                ) { Text("Разрешить", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun WidgetPinScreen(
    partnerName: String?,
    onDone: (Boolean) -> Unit,
) {
    val context = LocalContext.current
    val appWidgetManager = remember { AppWidgetManager.getInstance(context) }
    val componentName = remember { ComponentName(context, ValentineWidget::class.java) }
    var manual by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        StepHeader(
            title = if (manual) "Добавьте виджет вручную" else "Добавим виджет?",
            sub = if (manual) {
                "Система не смогла открыть диалог автоматически — на MIUI и ряде лаунчеров это норма"
            } else {
                "Так валентинки будут появляться прямо на рабочем столе"
            },
        )
        Spacer(Modifier.height(24.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgPanel2, RoundedCornerShape(20.dp))
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (manual) {
                Text(
                    "1. Зажмите пустое место на рабочем столе\n" +
                        "2. Выберите «Виджеты»\n" +
                        "3. Найдите «Валентинки» и перетащите на стол\n" +
                        "\nПосле этого вернитесь в приложение",
                    fontSize = 14.sp,
                    color = TextCream,
                    lineHeight = 21.sp,
                )
                Spacer(Modifier.height(16.dp))
                WidgetPreview(partnerName = partnerName)
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onDone(true) },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentAndroid,
                        contentColor = Color(0xFF0F2417),
                    ),
                ) { Text("Я добавил(а) виджет", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { manual = false },
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.06f),
                        contentColor = TextMuted,
                    ),
                ) { Text("Вернуться к авто-добавлению") }
            } else {
                WidgetPreview(partnerName = partnerName)
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        val success = appWidgetManager.requestPinAppWidget(componentName, null, null)
                        if (success) {
                            onDone(true)
                        } else {
                            manual = true
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AccentAndroid,
                        contentColor = Color(0xFF0F2417),
                    ),
                ) { Text("Добавить на рабочий стол", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
                Spacer(Modifier.height(8.dp))
                Text("откроется системный диалог лаунчера", fontSize = 11.sp, color = TextFaint)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Уже добавили? Закройте виджет-меню и нажмите",
                    fontSize = 11.sp,
                    color = TextFaint,
                )
                Text(
                    "«Я добавил(а)» ниже",
                    fontSize = 11.sp,
                    color = TextFaint,
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onDone(true) },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.06f),
                        contentColor = TextMuted,
                    ),
                ) { Text("Я добавил(а) виджет") }
            }
        }
    }
}

@Composable
private fun WidgetPreview(partnerName: String?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(70.dp)
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(BgPanel3, Color(0xFF2A1424)),
                ),
                shape = RoundedCornerShape(14.dp),
            )
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .background(AccentCoralDim, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) { Text("💌", fontSize = 16.sp) }
        Spacer(Modifier.width(12.dp))
        Column {
            Row {
                Text("♥", color = AccentCoral)
                Spacer(Modifier.width(4.dp))
                Text(
                    (partnerName ?: "Аня") + " отправила валентинку",
                    fontSize = 13.sp,
                    color = TextCream,
                    fontFamily = FontFamily.Cursive,
                )
            }
            Spacer(Modifier.height(5.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.55f)
                    .height(7.dp)
                    .background(Color.White.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
            )
        }
    }
}

@Composable
private fun SetupDoneScreen(
    pushEnabled: Boolean,
    onTogglePush: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("✅", fontSize = 40.sp)
        Spacer(Modifier.height(16.dp))
        Text("Готово!", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(10.dp))
        Text(
            "Виджет теперь будет обновляться сам, когда придёт новая валентинка.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
            modifier = Modifier.width(260.dp),
        )
        Spacer(Modifier.height(28.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BgPanel2, RoundedCornerShape(20.dp))
                .padding(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Уведомления", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Уведомлять о новых валентинках",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                }
                Switch(
                    checked = pushEnabled,
                    onCheckedChange = onTogglePush,
                )
            }
        }
    }
}