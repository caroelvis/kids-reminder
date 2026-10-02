package com.caroelvis.alarmreminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 鬧鐘時間到 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmScheduler.ACTION_FIRE) return
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val r = AlarmScheduler.loadReminders(context).firstOrNull { it.id == id }
    val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: r?.title ?: "提醒"
    val message = intent.getStringExtra(AlarmScheduler.EXTRA_MESSAGE) ?: r?.message ?: ""
    if (id != AlarmScheduler.TEST_ID) {
      if (r == null || !r.enabled) return
      AlarmScheduler.scheduleNext(context, id)
    }
    AlarmScheduler.fire(context, id, title, message)
  }
}
