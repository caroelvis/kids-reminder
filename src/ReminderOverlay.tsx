// 全螢幕提醒畫面：嘟嘟 + 對話框 + 「我知道了！」按鈕
// 有語音檔（內建或家長錄音）就播語音檔；沒有才用文字轉語音。
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Mascot from './Mascot';
import { speak, stopSpeaking } from './speech';
import { clipFor } from './voice';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  voiceUri?: string;
  onClose: () => void;
  onDismiss?: () => void; // 按了「我知道了！」（取消通知、離開鎖定畫面模式）
};

const MAX_PLAYS = 3; // 自動最多念 3 次
const REPEAT_GAP_MS = 2000; // 念完後等 2 秒再念

export default function ReminderOverlay({ visible, title, message, voiceUri, onClose, onDismiss }: Props) {
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  // 播放控制：每次播放都有一個編號，舊的回呼（例如被中斷的語音）會被忽略
  const gen = useRef(0);
  const playsLeft = useRef(0); // 這一輪自動重複還剩幾次
  const usingClip = useRef(false);
  const clipActive = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false); // 畫面是否還開著（還沒按「我知道了！」）

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const stopAll = () => {
    gen.current++;
    clearTimer();
    clipActive.current = false;
    stopSpeaking();
    try {
      player.pause();
    } catch {}
    setTtsSpeaking(false);
  };

  // 念完一次之後：如果還有次數、畫面還開著，就等 2 秒再念
  const onFinished = (myGen: number) => {
    if (myGen !== gen.current || !active.current) return;
    clipActive.current = false;
    setTtsSpeaking(false);
    if (playsLeft.current > 0) {
      clearTimer();
      timer.current = setTimeout(() => {
        if (myGen === gen.current && active.current) playOnce();
      }, REPEAT_GAP_MS);
    }
  };

  const playOnce = () => {
    const myGen = ++gen.current;
    playsLeft.current = Math.max(0, playsLeft.current - 1);
    clearTimer();
    stopSpeaking();
    const src = clipFor(message, voiceUri);
    if (src) {
      try {
        usingClip.current = true;
        clipActive.current = true;
        setTtsSpeaking(false);
        player.replace(src);
        player.seekTo(0).catch(() => {});
        player.play();
        return;
      } catch {
        // 播放失敗就改用文字轉語音
        clipActive.current = false;
      }
    }
    usingClip.current = false;
    setTtsSpeaking(true);
    speak(
      message,
      () => myGen === gen.current && setTtsSpeaking(true),
      () => onFinished(myGen),
      () => myGen === gen.current && setTtsSpeaking(false)
    );
  };

  // 語音檔播完 → 進入「等 2 秒再念」
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish && usingClip.current && clipActive.current) onFinishedRef.current(gen.current);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!visible) return;
    active.current = true;
    playsLeft.current = MAX_PLAYS;
    playOnce(); // 一出現就馬上開口，不等動畫
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    return () => {
      active.current = false;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message, voiceUri]);

  // 「再聽一次」：只念一次，不再自動重複
  const again = () => {
    stopAll();
    playsLeft.current = 1;
    playOnce();
  };

  // 「我知道了！」：馬上停止（包含念到一半）
  const close = () => {
    active.current = false;
    stopAll();
    onDismiss?.();
    onClose();
  };

  // Android 返回鍵 = 我知道了
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 嘴巴跟著聲音動：語音檔正在播放，或文字轉語音正在念
  const speaking = (usingClip.current && clipActive.current && status.playing) || ttsSpeaking;

  if (!visible) return null;

  return (
    // 不用 Modal：直接蓋在整個畫面上，這樣在鎖定畫面上也看得到
    <View style={[StyleSheet.absoluteFill, styles.bg]}>
        <Text style={styles.title}>{title}</Text>
        <Animated.View style={[styles.bubble, { transform: [{ scale: pop }] }]}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.tail} />
        </Animated.View>
        <Pressable onPress={again} accessibilityLabel="再聽一次">
          <Mascot speaking={speaking} size={230} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ok, pressed && { transform: [{ scale: 0.96 }] }]} onPress={close}>
          <Text style={styles.okText}>我知道了！</Text>
        </Pressable>
        <Pressable onPress={again} style={styles.againBtn}>
          <Text style={styles.againText}>🔊 再聽一次</Text>
        </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#BDE7FF', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100, elevation: 100 },
  title: { fontSize: 30, fontWeight: '800', color: '#1D4E89', marginBottom: 16 },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 28,
    borderWidth: 4,
    borderColor: '#FFB703',
    maxWidth: '100%',
  },
  tail: {
    position: 'absolute',
    bottom: -18,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFB703',
  },
  message: { fontSize: 38, lineHeight: 52, fontWeight: '900', color: '#333', textAlign: 'center' },
  ok: {
    marginTop: 24,
    backgroundColor: '#FF8A3D',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 40,
    elevation: 4,
  },
  okText: { fontSize: 34, fontWeight: '900', color: '#fff' },
  againBtn: { marginTop: 16, padding: 10 },
  againText: { fontSize: 22, color: '#1D4E89', fontWeight: '700' },
});
