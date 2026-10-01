// 上學小提醒：主畫面
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  DEFAULT_REMINDERS,
  Reminder,
  WEEKDAY_LABELS,
  formatTime,
  loadReminders,
  newId,
  saveReminders,
} from './src/storage';
import { ensurePermission, rescheduleAll, setupChannel } from './src/notifications';
import ReminderOverlay from './src/ReminderOverlay';

const PACKAGE = 'com.caroelvis.kidsreminder';

type Showing = { title: string; message: string } | null;

export default function App() {
  const [list, setList] = useState<Reminder[] | null>(null);
  const [permOk, setPermOk] = useState(true);
  const [showing, setShowing] = useState<Showing>(null);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const handledIds = useRef(new Set<string>());

  const showFromNotification = useCallback((n: Notifications.Notification) => {
    const id = n.request.identifier + ':' + n.date;
    if (handledIds.current.has(id)) return;
    handledIds.current.add(id);
    const data = (n.request.content.data || {}) as any;
    setShowing({
      title: data.title || n.request.content.title || '提醒',
      message: data.message || n.request.content.body || '',
    });
  }, []);

  // 第一次開啟：載入資料、建立通知頻道、要求權限、排程
  useEffect(() => {
    (async () => {
      await setupChannel();
      const ok = await ensurePermission();
      setPermOk(ok);
      const loaded = await loadReminders();
      setList(loaded);
      if (ok) await rescheduleAll(loaded);
    })();
  }, []);

  // 通知到達（App 在前景）或使用者點了通知 → 顯示嘟嘟並念出來
  useEffect(() => {
    const recv = Notifications.addNotificationReceivedListener(showFromNotification);
    const tap = Notifications.addNotificationResponseReceivedListener((r) => showFromNotification(r.notification));
    // App 是因為點通知才被打開的情況
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) {
        showFromNotification(r.notification);
        Notifications.clearLastNotificationResponseAsync?.();
      }
    });
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'active') {
        const p = await Notifications.getPermissionsAsync();
        setPermOk(p.granted);
      }
    });
    return () => {
      recv.remove();
      tap.remove();
      sub.remove();
    };
  }, [showFromNotification]);

  const update = async (next: Reminder[]) => {
    setList(next);
    await saveReminders(next);
    if (permOk) await rescheduleAll(next);
  };

  const askPermission = async () => {
    const ok = await ensurePermission();
    setPermOk(ok);
    if (ok && list) await rescheduleAll(list);
    if (!ok && Platform.OS === 'android') {
      IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
        extra: { 'android.provider.extra.APP_PACKAGE': PACKAGE },
      }).catch(() => {});
    }
  };

  const openExactAlarm = () =>
    IntentLauncher.startActivityAsync('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', {
      data: `package:${PACKAGE}`,
    }).catch(() => Alert.alert('無法開啟', '請到「設定 → 應用程式 → 上學小提醒」手動開啟「鬧鐘與提醒」。'));

  const openBattery = () =>
    IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
      Alert.alert('無法開啟', '請到「設定 → 電池」把「上學小提醒」設為「不限制 / 不最佳化」。')
    );

  const testNow = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ 測試提醒',
        body: '這是 10 秒後的測試通知喔！',
        sound: 'default',
        data: { title: '測試提醒', message: '這是 10 秒後的測試通知喔！' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        channelId: 'school-reminders',
      },
    });
    Alert.alert('好的！', '10 秒後會跳出測試通知。可以先回到桌面試試看。');
  };

  if (!list) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.h1}>載入中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 48, paddingBottom: 60 }}>
        <Text style={styles.h1}>🐥 上學小提醒</Text>

        {!permOk && (
          <Pressable style={[styles.bigBtn, { backgroundColor: '#E63946' }]} onPress={askPermission}>
            <Text style={styles.bigBtnText}>🔔 請按這裡開啟通知</Text>
          </Pressable>
        )}

        {list.map((r) => (
          <View key={r.id} style={[styles.card, !r.enabled && { opacity: 0.55 }]}>
            <View style={styles.row}>
              <Text style={styles.time}>{formatTime(r.hour, r.minute)}</Text>
              <View style={{ flex: 1 }} />
              <Switch
                value={r.enabled}
                onValueChange={(v) => update(list.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))}
                style={{ transform: [{ scale: 1.4 }] }}
              />
            </View>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cardMsg}>{r.message}</Text>
            <Text style={styles.days}>
              {r.weekdays.length === 0
                ? '沒有選星期'
                : '星期' + [...r.weekdays].sort().map((d) => WEEKDAY_LABELS[d - 1]).join('、')}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, { backgroundColor: '#2A9D8F' }]}
                onPress={() => setShowing({ title: r.title, message: r.message })}
              >
                <Text style={styles.btnText}>🔊 試聽</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#457B9D' }]} onPress={() => setEditing({ ...r })}>
                <Text style={styles.btnText}>✏️ 修改</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable
          style={[styles.bigBtn, { backgroundColor: '#FF8A3D' }]}
          onPress={() =>
            setEditing({
              id: newId(),
              title: '新提醒',
              message: '記得帶水壺喔！',
              hour: 7,
              minute: 10,
              weekdays: [1, 2, 3, 4, 5],
              enabled: true,
            })
          }
        >
          <Text style={styles.bigBtnText}>➕ 新增提醒</Text>
        </Pressable>

        <Text style={styles.section}>給爸爸媽媽 👨‍👩‍👧</Text>
        <Pressable style={styles.smallBtn} onPress={testNow}>
          <Text style={styles.smallBtnText}>⏱️ 10 秒後測試通知</Text>
        </Pressable>
        {Platform.OS === 'android' && (
          <>
            <Pressable style={styles.smallBtn} onPress={openExactAlarm}>
              <Text style={styles.smallBtnText}>⏰ 允許準時鬧鐘（鬧鐘與提醒）</Text>
            </Pressable>
            <Pressable style={styles.smallBtn} onPress={openBattery}>
              <Text style={styles.smallBtnText}>🔋 關閉電池最佳化（避免通知延遲）</Text>
            </Pressable>
          </>
        )}
        <Pressable
          style={styles.smallBtn}
          onPress={() =>
            Alert.alert('恢復預設？', '會刪掉自己新增的提醒，回到原本的兩個提醒。', [
              { text: '取消', style: 'cancel' },
              { text: '恢復', style: 'destructive', onPress: () => update(DEFAULT_REMINDERS) },
            ])
          }
        >
          <Text style={styles.smallBtnText}>↩️ 恢復預設提醒</Text>
        </Pressable>
      </ScrollView>

      {editing && (
        <EditModal
          value={editing}
          isNew={!list.some((x) => x.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={(r) => {
            const exists = list.some((x) => x.id === r.id);
            update(exists ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]);
            setEditing(null);
          }}
          onDelete={(id) => {
            update(list.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}

      <ReminderOverlay
        visible={!!showing}
        title={showing?.title ?? ''}
        message={showing?.message ?? ''}
        onClose={() => setShowing(null)}
      />
    </View>
  );
}

function EditModal({
  value,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  value: Reminder;
  isNew: boolean;
  onCancel: () => void;
  onSave: (r: Reminder) => void;
  onDelete: (id: string) => void;
}) {
  const [r, setR] = useState<Reminder>(value);
  const [showPicker, setShowPicker] = useState(false);

  const toggleDay = (d: number) =>
    setR({ ...r, weekdays: r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d] });

  const onTime = (e: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    if (e.type === 'set' && date) setR({ ...r, hour: date.getHours(), minute: date.getMinutes() });
  };

  const pickerDate = new Date();
  pickerDate.setHours(r.hour, r.minute, 0, 0);

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: 48 }}>
        <Text style={styles.h1}>{isNew ? '新增提醒' : '修改提醒'}</Text>

        <Text style={styles.label}>名稱</Text>
        <TextInput style={styles.input} value={r.title} onChangeText={(t) => setR({ ...r, title: t })} />

        <Text style={styles.label}>要說的話</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          multiline
          value={r.message}
          onChangeText={(t) => setR({ ...r, message: t })}
        />

        <Text style={styles.label}>時間</Text>
        <Pressable style={[styles.bigBtn, { backgroundColor: '#457B9D' }]} onPress={() => setShowPicker(true)}>
          <Text style={[styles.bigBtnText, { fontSize: 40 }]}>🕒 {formatTime(r.hour, r.minute)}</Text>
        </Pressable>
        {showPicker && <DateTimePicker value={pickerDate} mode="time" is24Hour display="default" onChange={onTime} />}

        <Text style={styles.label}>星期幾</Text>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {WEEKDAY_LABELS.map((lbl, i) => {
            const d = i + 1;
            const on = r.weekdays.includes(d);
            return (
              <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]}>
                <Text style={[styles.dayText, on && { color: '#fff' }]}>{lbl}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.bigBtn, { backgroundColor: '#2A9D8F', marginTop: 24 }]}
          onPress={() => {
            if (!r.message.trim()) return Alert.alert('還沒寫要說的話喔');
            onSave({ ...r, title: r.title.trim() || '提醒', message: r.message.trim() });
          }}
        >
          <Text style={styles.bigBtnText}>💾 儲存</Text>
        </Pressable>
        <Pressable style={[styles.bigBtn, { backgroundColor: '#999' }]} onPress={onCancel}>
          <Text style={styles.bigBtnText}>取消</Text>
        </Pressable>
        {!isNew && (
          <Pressable
            style={[styles.bigBtn, { backgroundColor: '#E63946' }]}
            onPress={() =>
              Alert.alert('確定要刪除嗎？', `「${r.title}」會被刪掉`, [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => onDelete(r.id) },
              ])
            }
          >
            <Text style={styles.bigBtnText}>🗑️ 刪除這個提醒</Text>
          </Pressable>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8E7' },
  h1: { fontSize: 34, fontWeight: '900', color: '#1D4E89', textAlign: 'center', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FFD84D',
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { fontSize: 48, fontWeight: '900', color: '#E76F51' },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#264653', marginTop: 4 },
  cardMsg: { fontSize: 24, color: '#333', marginVertical: 6 },
  days: { fontSize: 18, color: '#666', marginBottom: 12 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
  btnText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  bigBtn: { paddingVertical: 20, borderRadius: 24, alignItems: 'center', marginVertical: 8 },
  bigBtnText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  section: { fontSize: 20, fontWeight: '800', color: '#666', marginTop: 28, marginBottom: 8 },
  smallBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginVertical: 5, borderWidth: 1, borderColor: '#ddd' },
  smallBtnText: { fontSize: 18, color: '#333' },
  label: { fontSize: 22, fontWeight: '800', color: '#264653', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#ccc', fontSize: 24, padding: 12 },
  day: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: '#457B9D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dayOn: { backgroundColor: '#457B9D' },
  dayText: { fontSize: 24, fontWeight: '900', color: '#457B9D' },
});
