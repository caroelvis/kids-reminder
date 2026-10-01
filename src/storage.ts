// 提醒資料的格式，以及存到手機裡（AsyncStorage）的功能
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Reminder = {
  id: string;
  title: string; // 例如「早餐提醒」
  message: string; // 要念出來的話
  hour: number; // 0–23
  minute: number; // 0–59
  weekdays: number[]; // 1=星期一 … 7=星期日
  enabled: boolean;
  voiceUri?: string; // 家長自己錄的聲音（手機裡的檔案位置），沒有就用內建語音或文字轉語音
};

const KEY = 'kids-reminder/reminders/v1';

export const MORNING_TEXT = '登登登登～Rita、Silvia 小朋友，上學前記得拿餐袋喔！';
const OLD_MORNING_TEXT = '記得帶餐袋喔！';

export const DEFAULT_REMINDERS: Reminder[] = [
  {
    id: 'breakfast',
    title: '早餐提醒',
    message: MORNING_TEXT,
    hour: 7,
    minute: 0,
    weekdays: [1, 2, 3, 4, 5],
    enabled: true,
  },
  {
    id: 'home',
    title: '回家提醒',
    message: '記得把聯絡簿和功課拿出來喔！',
    hour: 18,
    minute: 30,
    weekdays: [1, 2, 3, 4, 5],
    enabled: true,
  },
];

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_REMINDERS;
    // 舊版（v1.0.3 以前）的早餐提醒如果還是原本的預設文字，就換成新的；自己改過的文字不動
    let changed = false;
    const list: Reminder[] = parsed.map((r: Reminder) => {
      if (r.id === 'breakfast' && r.message === OLD_MORNING_TEXT) {
        changed = true;
        return { ...r, message: MORNING_TEXT };
      }
      return r;
    });
    if (changed) await saveReminders(list);
    return list;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminders(list: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export function newId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
