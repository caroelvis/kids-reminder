// 全螢幕提醒畫面：嘟嘟 + 對話框 + 「我知道了！」按鈕
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Mascot from './Mascot';
import { speak, stopSpeaking } from './speech';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export default function ReminderOverlay({ visible, title, message, onClose }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    setSpeaking(true);
    speak(
      message,
      () => setSpeaking(true),
      () => setSpeaking(false)
    );
    // 保險：最久 12 秒後嘴巴停下來
    const t = setTimeout(() => setSpeaking(false), 12000);
    return () => clearTimeout(t);
  }, [visible, message, pop]);

  const close = () => {
    stopSpeaking();
    setSpeaking(false);
    onClose();
  };

  const again = () => {
    setSpeaking(true);
    speak(message, () => setSpeaking(true), () => setSpeaking(false));
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.bg}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#BDE7FF', alignItems: 'center', justifyContent: 'center', padding: 24 },
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
