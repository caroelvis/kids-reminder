package com.caroelvis.alarmreminder

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/** 收到「鬧鐘」啟動的 Intent 時：讓畫面顯示在鎖定畫面上並點亮螢幕 */
object LaunchState {
  var activity: WeakReference<Activity>? = null
  @Volatile var pending: Map<String, String>? = null
  var listener: ((Map<String, String>) -> Unit)? = null

  fun handle(activity: Activity?, intent: Intent?) {
    val id = intent?.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val data = mapOf(
      "id" to id,
      "title" to (intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: ""),
      "message" to (intent.getStringExtra(AlarmScheduler.EXTRA_MESSAGE) ?: "")
    )
    intent.removeExtra(AlarmScheduler.EXTRA_ID)
    pending = data
    activity?.let { setLockScreen(it, true) }
    listener?.invoke(data)
  }

  fun setLockScreen(activity: Activity, on: Boolean) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(on)
        activity.setTurnScreenOn(on)
      } else {
        @Suppress("DEPRECATION")
        val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        if (on) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
      }
      if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}

class AlarmReminderPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        LaunchState.activity = WeakReference(activity)
        LaunchState.handle(activity, activity.intent)
      }

      override fun onResume(activity: Activity) {
        LaunchState.activity = WeakReference(activity)
      }

      override fun onNewIntent(intent: Intent): Boolean {
        LaunchState.handle(LaunchState.activity?.get(), intent)
        return false
      }
    })
  }
}
