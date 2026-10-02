import { NativeModule, requireOptionalNativeModule } from 'expo';

export type LaunchReminder = { id: string; title: string; message: string };
export type AlarmStatus = {
  sdk: number;
  brand: string;
  notifications: boolean;
  exactAlarm: boolean;
  fullScreen: boolean;
  battery: boolean;
  overlay: boolean;
};
export type SettingsKind = 'notifications' | 'exactAlarm' | 'fullScreen' | 'battery' | 'overlay' | 'app';

type Events = { onReminderLaunch: (r: LaunchReminder) => void };

declare class AlarmReminderModule extends NativeModule<Events> {
  setReminders(json: string): number;
  cancelAll(): void;
  scheduleTest(seconds: number, title: string, message: string): void;
  getNextTriggers(): Record<string, number>;
  consumeLaunchReminder(): LaunchReminder | null;
  dismiss(id: string): void;
  getStatus(): AlarmStatus;
  openSettings(kind: SettingsKind): boolean;
}

// Android 以外（或 Expo Go）沒有這個原生模組 → null
export default requireOptionalNativeModule<AlarmReminderModule>('AlarmReminder');
