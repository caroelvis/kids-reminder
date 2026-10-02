package com.caroelvis.alarmreminder

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlarmReminderModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no context")

  override fun definition() = ModuleDefinition {
    Name("AlarmReminder")
    Events("onReminderLaunch")

    OnCreate {
      LaunchState.listener = { data -> sendEvent("onReminderLaunch", data) }
    }
    OnDestroy {
      LaunchState.listener = null
    }

    /** 存下所有提醒（JSON），並重新排程；回傳排了幾個 */
    Function("setReminders") { json: String ->
      AlarmScheduler.ensureChannel(ctx)
      AlarmScheduler.saveReminders(ctx, json)
      AlarmScheduler.scheduleAll(ctx)
    }

    Function("cancelAll") { AlarmScheduler.cancelAll(ctx) }

    Function("scheduleTest") { seconds: Int, title: String, message: String ->
      AlarmScheduler.ensureChannel(ctx)
      AlarmScheduler.scheduleTest(ctx, seconds, title, message)
    }

    Function("getNextTriggers") { AlarmScheduler.nextTriggers(ctx).mapValues { it.value.toDouble() } }

    /** App 是被鬧鐘打開的話，拿到是哪個提醒（只拿一次） */
    Function("consumeLaunchReminder") {
      val p = LaunchState.pending
      LaunchState.pending = null
      p
    }

    /** 孩子按了「我知道了！」：取消通知、不再顯示在鎖定畫面上 */
    Function("dismiss") { id: String ->
      AlarmScheduler.cancelNotification(ctx, id)
      LaunchState.activity?.get()?.let { LaunchState.setLockScreen(it, false) }
    }

    Function("getStatus") {
      val c = ctx
      val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val pm = c.getSystemService(Context.POWER_SERVICE) as PowerManager
      mapOf(
        "sdk" to Build.VERSION.SDK_INT,
        "brand" to Build.MANUFACTURER,
        "notifications" to NotificationManagerCompat.from(c).areNotificationsEnabled(),
        "exactAlarm" to AlarmScheduler.canScheduleExact(c),
        "fullScreen" to (if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent() else true),
        "battery" to (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pm.isIgnoringBatteryOptimizations(c.packageName) else true),
        "overlay" to (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(c) else true)
      )
    }

    /** 打開系統設定頁：notifications / exactAlarm / fullScreen / battery / overlay / app */
    Function("openSettings") { kind: String ->
      val c = ctx
      val pkg = Uri.parse("package:${c.packageName}")
      val intent = when (kind) {
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.packageName)
        "exactAlarm" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) else null
        "fullScreen" -> if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) else null
        "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)
        "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg)
        else -> null
      } ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        c.startActivity(intent)
        true
      } catch (e: Exception) {
        try {
          c.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          true
        } catch (e2: Exception) {
          false
        }
      }
    }
  }
}
