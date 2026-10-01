// 通知相關：建立通知頻道、要求權限、排程每週重複的提醒
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from './storage';

export const CHANNEL_ID = 'school-reminders';

// App 開著的時候，通知也要跳出來並發出聲音
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '上學提醒',
    description: '每天上學日的提醒通知',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// 我們用 1=星期一 … 7=星期日；expo-notifications 用 1=星期日 … 7=星期六
function toExpoWeekday(d: number): number {
  return (d % 7) + 1;
}

export async function rescheduleAll(list: Reminder[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  let count = 0;
  for (const r of list) {
    if (!r.enabled) continue;
    for (const d of r.weekdays) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${r.title}`,
          body: r.message,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { reminderId: r.id, title: r.title, message: r.message },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(d),
          hour: r.hour,
          minute: r.minute,
          channelId: CHANNEL_ID,
        },
      });
      count++;
    }
  }
  return count;
}
