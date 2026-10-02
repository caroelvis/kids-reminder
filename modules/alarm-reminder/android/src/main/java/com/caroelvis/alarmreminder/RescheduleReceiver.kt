package com.caroelvis.alarmreminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 開機、更新 App、改時間/時區、鬧鐘權限改變 → 重新排程 */
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.scheduleAll(context)
  }
}
