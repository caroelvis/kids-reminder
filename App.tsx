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
import AlarmReminder, { AlarmStatus, LaunchReminder, SettingsKind } from './modules/alarm-reminder';
import ReminderOverlay from './src/ReminderOverlay';
import { BUNDLED_CLIPS, initAudio } from './src/voice';
import { warmUpSpeech } from './src/speech';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';

// App 一啟動就先準備聲音，提醒出現時才不會慢
initAudio();

const PACKAGE = 'com.caroelvis.kidsreminder';

type Showing = { id?: string; title: string; message: string; voiceUri?: string } | null;

export default function App() {
  const [list, setList] = useState<Reminder[] | null>(null);
  const [permOk, setPermOk] = useState(true);
  const [showing, setShowing] = useState<Showing>(null);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const handledIds = useRef(new Set<string>());
  const listRef = useRef<Reminder[] | null>(null);
  listRef.current = list;

  const showFromNotification = useCallback((n: Notifications.Notification) => {
    const id = n.request.identifier + ':' + n.date;
    if (handledIds.current.has(id)) return;
    handledIds.current.add(id);
    const data = (n.request.content.data || {}) as any;
    const r = listRef.current?.find((x) => x.id === data.reminderId);
    setShowing({
      title: r?.title || data.title || n.request.content.title || '提醒',
      message: r?.message || data.message || n.request.content.body || '',
      voiceUri: r?.voiceUri,
    });
  }, []);

  const [status, setStatus] = useState<AlarmStatus | null>(null);
  const refreshStatus = useCallback(() => {
    try {
      if (AlarmReminder) setStatus(AlarmReminder.getStatus());
    } catch {}
  }, []);

  // 被「鬧鐘」打開（或 App 開著時鬧鐘響了）→ 直接顯示嘟嘟並開始念
  const showFromAlarm = useCallback((l: LaunchReminder | null | undefined) => {
    if (!l || !l.id) return;
    const r = listRef.current?.find((x) => x.id === l.id);
    setEditing(null);
    setShowing({
      id: l.id,
      title: r?.title || l.title || '提醒',
      message: r?.message || l.message || '',
      voiceUri: r?.voiceUri,
    });
  }, []);

  // 第一次開啟：載入資料、建立通知頻道、要求權限、排程
  useEffect(() => {
    warmUpSpeech();
    (async () => {
      const loaded = await loadReminders();
      listRef.current = loaded;
      setList(loaded);
      if (AlarmReminder) showFromAlarm(AlarmReminder.consumeLaunchReminder());
      await setupChannel();
      const ok = await ensurePermission();
      setPermOk(ok);
      await syncAlarms(loaded, ok);
      refreshStatus();
    })();
  }, [showFromAlarm, refreshStatus]);

  // App 開著時鬧鐘響了（或從背景被叫到前面）
  useEffect(() => {
    if (!AlarmReminder) return;
    const sub = AlarmReminder.addListener('onReminderLaunch', (l) => {
      AlarmReminder?.consumeLaunchReminder();
      showFromAlarm(l);
    });
    return () => sub.remove();
  }, [showFromAlarm]);

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
        refreshStatus();
        if (AlarmReminder) showFromAlarm(AlarmReminder.consumeLaunchReminder());
      }
    });
    return () => {
      recv.remove();
      tap.remove();
      sub.remove();
    };
  }, [showFromNotification, refreshStatus, showFromAlarm]);

  const update = async (next: Reminder[]) => {
    setList(next);
    await saveReminders(next);
    await syncAlarms(next, permOk);
  };

  const askPermission = async () => {
    const ok = await ensurePermission();
    setPermOk(ok);
    if (ok && list) await syncAlarms(list, ok);
    if (!ok) openSettings('notifications');
    refreshStatus();
  };

  const openSettings = (kind: SettingsKind) => {
    if (AlarmReminder?.openSettings(kind)) return;
    IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${PACKAGE}`,
    }).catch(() => Alert.alert('無法開啟', '請到「設定 → 應用程式 → 上學小提醒」手動設定。'));
  };

  const testNow = async () => {
    if (AlarmReminder) {
      AlarmReminder.scheduleTest(10, '測試提醒', '這是 10 秒後的測試通知喔！');
      Alert.alert('好的！', '10 秒後嘟嘟會跳出來。現在可以先按電源鍵把手機鎖起來，看看會不會自己跳出來喔！');
      return;
    }
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
    Alert.alert('好的！', '10 秒後會跳出測試通知。');
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
            <Text style={styles.voiceTag}>
              {r.voiceUri ? '🎙️ 爸媽錄的聲音' : BUNDLED_CLIPS[r.message.trim()] ? '🎀 嘟嘟的聲音' : '📱 手機語音'}
            </Text>
            <Text style={styles.days}>
              {r.weekdays.length === 0
                ? '沒有選星期'
                : '星期' + [...r.weekdays].sort().map((d) => WEEKDAY_LABELS[d - 1]).join('、')}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, { backgroundColor: '#2A9D8F' }]}
                onPress={() => setShowing({ title: r.title, message: r.message, voiceUri: r.voiceUri })}
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
        {status && (
          <View style={styles.checkCard}>
            <Text style={styles.checkTitle}>要讓嘟嘟像鬧鐘一樣自己跳出來，請確認：</Text>
            <CheckRow ok={status.notifications} label="通知" fix="開啟通知" onFix={askPermission} />
            <CheckRow ok={status.exactAlarm} label="準時鬧鐘（鬧鐘與提醒）" fix="允許" onFix={() => openSettings('exactAlarm')} />
            <CheckRow ok={status.fullScreen} label="全螢幕跳出" fix="允許全螢幕跳出" onFix={() => openSettings('fullScreen')} />
            <CheckRow ok={status.battery} label="不受電池最佳化限制" fix="關閉電池最佳化" onFix={() => openSettings('battery')} />
            <CheckRow
              ok={status.overlay}
              label="顯示在其他應用程式上層（建議，手機沒鎖時也能直接跳出）"
              fix="允許"
              onFix={() => openSettings('overlay')}
            />
            <Text style={styles.hint}>
              小米、OPPO、vivo、realme 等手機還要在「應用程式詳細資料 → 其他權限」打開「後台彈出介面」、「鎖定畫面顯示」，
              並允許「自啟動」。
            </Text>
            <Pressable style={styles.smallBtn} onPress={() => openSettings('app')}>
              <Text style={styles.smallBtnText}>⚙️ 開啟 App 詳細設定</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.smallBtn} onPress={testNow}>
          <Text style={styles.smallBtnText}>⏱️ 10 秒後測試（按完把手機鎖起來試試看）</Text>
        </Pressable>
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
        onDismiss={() => {
          if (showing?.id) AlarmReminder?.dismiss(showing.id);
        }}
        voiceUri={showing?.voiceUri}
        title={showing?.title ?? ''}
        message={showing?.message ?? ''}
        onClose={() => setShowing(null)}
      />
    </View>
  );
}

function CheckRow({ ok, label, fix, onFix }: { ok: boolean; label: string; fix: string; onFix: () => void }) {
  return (
    <View style={[styles.row, { marginVertical: 4 }]}>
      <Text style={{ fontSize: 22 }}>{ok ? '✅' : '❌'}</Text>
      <Text style={{ flex: 1, fontSize: 17, color: '#333' }}>{label}</Text>
      {!ok && (
        <Pressable style={styles.fixBtn} onPress={onFix}>
          <Text style={styles.fixBtnText}>{fix}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 把提醒交給 Android 鬧鐘排程；沒有原生模組時（例如 Expo Go）改用一般通知 */
async function syncAlarms(list: Reminder[], permOk: boolean) {
  if (AlarmReminder) {
    // 舊版（v1.0.x）用 expo-notifications 排的通知全部取消，避免重複響
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    AlarmReminder.setReminders(
      JSON.stringify(
        list.map(({ id, title, message, hour, minute, weekdays, enabled }) => ({
          id,
          title,
          message,
          hour,
          minute,
          weekdays,
          enabled,
        }))
      )
    );
    return;
  }
  if (permOk) await rescheduleAll(list);
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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const preview = useAudioPlayer(null);

  const startRec = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要麥克風', '請允許使用麥克風，才能錄自己的聲音。');
    try {
      preview.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert('無法錄音', String(e));
    }
  };

  const stopRec = async (): Promise<string | undefined> => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return undefined;
      const dest = new File(Paths.document, `voice-${r.id}-${Date.now()}.m4a`);
      await new File(uri).copy(dest);
      setR((cur) => ({ ...cur, voiceUri: dest.uri }));
      return dest.uri;
    } catch (e) {
      Alert.alert('錄音失敗', String(e));
    }
  };

  const playRec = () => {
    if (!r.voiceUri) return;
    preview.replace({ uri: r.voiceUri });
    preview.seekTo(0).catch(() => {});
    preview.play();
  };

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

        <Text style={styles.label}>爸媽錄音（可以不錄）</Text>
        <Text style={styles.hint}>
          錄了之後，提醒時會播放你的聲音；沒錄的話，會用嘟嘟的聲音（內建的句子）或手機語音。
        </Text>
        {recState.isRecording ? (
          <Pressable style={[styles.bigBtn, { backgroundColor: '#E63946' }]} onPress={() => stopRec()}>
            <Text style={styles.bigBtnText}>⏹️ 停止錄音（{Math.floor((recState.durationMillis || 0) / 1000)} 秒）</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.bigBtn, { backgroundColor: '#8E44AD' }]} onPress={startRec}>
            <Text style={styles.bigBtnText}>🎙️ {r.voiceUri ? '重新錄音' : '錄自己的聲音'}</Text>
          </Pressable>
        )}
        {r.voiceUri && !recState.isRecording && (
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: '#2A9D8F' }]} onPress={playRec}>
              <Text style={styles.btnText}>▶️ 聽錄音</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: '#999' }]} onPress={() => setR({ ...r, voiceUri: undefined })}>
              <Text style={styles.btnText}>🗑️ 不用錄音</Text>
            </Pressable>
          </View>
        )}

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
          onPress={async () => {
            let voiceUri = r.voiceUri;
            if (recState.isRecording) voiceUri = (await stopRec()) ?? voiceUri;
            if (!r.message.trim()) return Alert.alert('還沒寫要說的話喔');
            onSave({ ...r, voiceUri, title: r.title.trim() || '提醒', message: r.message.trim() });
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
  voiceTag: { fontSize: 16, color: '#8E44AD', marginBottom: 2 },
  hint: { fontSize: 16, color: '#666', marginBottom: 6 },
  checkCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: '#FFD84D' },
  checkTitle: { fontSize: 18, fontWeight: '800', color: '#264653', marginBottom: 6 },
  fixBtn: { backgroundColor: '#E76F51', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  fixBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
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
