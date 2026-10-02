package com.caroelvis.alarmreminder

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/** 一個提醒（和 JS 端 src/storage.ts 的 Reminder 對應） */
data class AlarmReminder(
  val id: String,
  val title: String,
  val message: String,
  val hour: Int,
  val minute: Int,
  val weekdays: Set<Int>, // 1=星期一 … 7=星期日
  val enabled: Boolean
)

object AlarmScheduler {
  private const val TAG = "AlarmReminder"
  private const val PREFS = "alarm_reminder"
  private const val KEY_REMINDERS = "reminders"
  private const val KEY_SCHEDULED = "scheduled_ids"
  const val CHANNEL_ID = "alarm-reminders-v1"
  const val ACTION_FIRE = "com.caroelvis.alarmreminder.FIRE"
  const val EXTRA_ID = "alarmReminderId"
  const val EXTRA_TITLE = "alarmReminderTitle"
  const val EXTRA_MESSAGE = "alarmReminderMessage"
  const val TEST_ID = "__test__"

  // ---------- 儲存 ----------
  fun saveReminders(ctx: Context, json: String) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_REMINDERS, json).apply()
  }

  fun loadReminders(ctx: Context): List<AlarmReminder> {
    val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_REMINDERS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { parse(arr.getJSONObject(it)) }
    } catch (e: Exception) {
      Log.w(TAG, "bad reminders json", e)
      emptyList()
    }
  }

  private fun parse(o: JSONObject): AlarmReminder {
    val days = o.optJSONArray("weekdays") ?: JSONArray()
    return AlarmReminder(
      id = o.getString("id"),
      title = o.optString("title", "提醒"),
      message = o.optString("message", ""),
      hour = o.optInt("hour", 7),
      minute = o.optInt("minute", 0),
      weekdays = (0 until days.length()).map { days.getInt(it) }.toSet(),
      enabled = o.optBoolean("enabled", true)
    )
  }

  // ---------- 排程 ----------
  fun requestCode(id: String): Int = id.hashCode() and 0x7fffffff

  /** 下一次要響的時間（毫秒）；沒有就回傳 null */
  fun nextTrigger(r: AlarmReminder, afterMillis: Long): Long? {
    if (!r.enabled || r.weekdays.isEmpty()) return null
    val cal = Calendar.getInstance()
    cal.timeInMillis = afterMillis
    cal.set(Calendar.HOUR_OF_DAY, r.hour)
    cal.set(Calendar.MINUTE, r.minute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    for (i in 0..7) {
      // Calendar：1=星期日 … 7=星期六 → 換成 1=星期一 … 7=星期日
      val dow = cal.get(Calendar.DAY_OF_WEEK)
      val ours = if (dow == Calendar.SUNDAY) 7 else dow - 1
      if (ours in r.weekdays && cal.timeInMillis > afterMillis) return cal.timeInMillis
      cal.add(Calendar.DAY_OF_MONTH, 1)
    }
    return null
  }

  private fun firePendingIntent(ctx: Context, id: String, title: String? = null, message: String? = null, create: Boolean = true): PendingIntent? {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_ID, id)
      if (title != null) putExtra(EXTRA_TITLE, title)
      if (message != null) putExtra(EXTRA_MESSAGE, message)
    }
    val flags = PendingIntent.FLAG_IMMUTABLE or if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE
    return PendingIntent.getBroadcast(ctx, requestCode(id), intent, flags)
  }

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.canScheduleExactAlarms()
  }

  private fun setAlarm(ctx: Context, triggerAt: Long, pi: PendingIntent) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    try {
      if (canScheduleExact(ctx)) {
        // 跟鬧鐘一樣：最準時，省電模式也會叫醒手機
        val show = launchPendingIntent(ctx, "__show__", null, null, 0x5eed)
        am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), pi)
      } else {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
      }
    } catch (e: SecurityException) {
      Log.w(TAG, "exact alarm not allowed, fallback", e)
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
    }
  }

  private fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    firePendingIntent(ctx, id, create = false)?.let {
      am.cancel(it)
      it.cancel()
    }
  }

  /** 依照儲存的提醒，重新排好每一個提醒的「下一次」 */
  fun scheduleAll(ctx: Context): Int {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.getStringSet(KEY_SCHEDULED, emptySet())?.forEach { cancel(ctx, it) }
    val now = System.currentTimeMillis()
    val scheduled = mutableSetOf<String>()
    for (r in loadReminders(ctx)) {
      val t = nextTrigger(r, now) ?: continue
      firePendingIntent(ctx, r.id)?.let { setAlarm(ctx, t, it) }
      scheduled.add(r.id)
    }
    prefs.edit().putStringSet(KEY_SCHEDULED, scheduled).apply()
    return scheduled.size
  }

  /** 響過之後，排下一次（至少一分鐘後，避免同一分鐘重複響） */
  fun scheduleNext(ctx: Context, id: String) {
    val r = loadReminders(ctx).firstOrNull { it.id == id } ?: return
    val t = nextTrigger(r, System.currentTimeMillis() + 60_000) ?: return
    firePendingIntent(ctx, r.id)?.let { setAlarm(ctx, t, it) }
  }

  fun cancelAll(ctx: Context) {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.getStringSet(KEY_SCHEDULED, emptySet())?.forEach { cancel(ctx, it) }
    prefs.edit().putStringSet(KEY_SCHEDULED, emptySet()).apply()
  }

  fun scheduleTest(ctx: Context, seconds: Int, title: String, message: String) {
    val pi = firePendingIntent(ctx, TEST_ID, title, message) ?: return
    setAlarm(ctx, System.currentTimeMillis() + seconds * 1000L, pi)
  }

  /** 列出每個提醒下一次響的時間（給 App 顯示） */
  fun nextTriggers(ctx: Context): Map<String, Long> {
    val now = System.currentTimeMillis()
    return loadReminders(ctx).mapNotNull { r -> nextTrigger(r, now)?.let { r.id to it } }.toMap()
  }

  // ---------- 通知 + 全螢幕 ----------
  fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val ch = NotificationChannel(CHANNEL_ID, "上學鬧鐘提醒", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "時間到時跳出嘟嘟的全螢幕提醒"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
    }
    nm.createNotificationChannel(ch)
  }

  fun launchIntent(ctx: Context, id: String?, title: String?, message: String?): Intent? {
    val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (id != null) {
      intent.putExtra(EXTRA_ID, id)
      intent.putExtra(EXTRA_TITLE, title ?: "")
      intent.putExtra(EXTRA_MESSAGE, message ?: "")
    }
    return intent
  }

  private fun launchPendingIntent(ctx: Context, id: String?, title: String?, message: String?, code: Int): PendingIntent {
    val intent = launchIntent(ctx, if (id == "__show__") null else id, title, message) ?: Intent()
    return PendingIntent.getActivity(ctx, code, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  fun notificationId(id: String): Int = 7000 + (requestCode(id) % 100000)

  private fun smallIcon(ctx: Context): Int {
    val res = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (res != 0) res else ctx.applicationInfo.icon
  }

  /** 時間到：發出全螢幕通知；如果有「顯示在其他應用程式上層」權限，也直接打開畫面 */
  fun fire(ctx: Context, id: String, title: String, message: String) {
    ensureChannel(ctx)
    val code = notificationId(id)
    val pi = launchPendingIntent(ctx, id, title, message, code)
    val n = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle("⏰ $title")
      .setContentText(message)
      .setStyle(NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(pi)
      .setFullScreenIntent(pi, true)
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
      .build()
    try {
      NotificationManagerCompat.from(ctx).notify(code, n)
    } catch (e: SecurityException) {
      Log.w(TAG, "no notification permission", e)
    }
    // 手機沒鎖、螢幕亮著時，Android 只會顯示橫幅；有「上層顯示」權限就直接打開嘟嘟
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(ctx)) {
      try {
        launchIntent(ctx, id, title, message)?.let { ctx.startActivity(it) }
      } catch (e: Exception) {
        Log.w(TAG, "direct start failed", e)
      }
    }
  }

  fun cancelNotification(ctx: Context, id: String) {
    NotificationManagerCompat.from(ctx).cancel(notificationId(id))
  }
}
