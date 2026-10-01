// 原創吉祥物「嘟嘟」：一隻圓滾滾的小黃雞。
// 會上下跳、揮手、眨眼睛，說話時嘴巴會一開一合。
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

type Props = { speaking: boolean; size?: number };

export default function Mascot({ speaking, size = 220 }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current; // 1=張開 0=閉上
  const mouth = useRef(new Animated.Value(0)).current; // 0=閉 1=張大

  // 上下跳
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  // 揮手
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(wave, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(wave, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  // 眨眼睛（每 2.5 秒左右眨一次）
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2300),
        Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: false }),
        Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);

  // 說話時嘴巴一開一合
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (speaking) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(mouth, { toValue: 1, duration: 140, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0.25, duration: 140, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0.8, duration: 120, useNativeDriver: false }),
          Animated.timing(mouth, { toValue: 0.1, duration: 160, useNativeDriver: false }),
        ])
      );
      loop.start();
    } else {
      Animated.timing(mouth, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
    return () => loop?.stop();
  }, [speaking, mouth]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] });
  const rotate = wave.interpolate({ inputRange: [-1, 1], outputRange: ['-25deg', '35deg'] });
  const eyeRy = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 13] });
  const mouthRy = mouth.interpolate({ inputRange: [0, 1], outputRange: [3, 16] });

  const s = size / 200; // 以 200x200 畫布為基準縮放

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* 影子 */}
        <Ellipse cx="100" cy="192" rx="55" ry="6" fill="#000" opacity={0.08} />
        {/* 頭頂呆毛 */}
        <Path d="M100 28 C92 10, 108 6, 104 22 C112 8, 124 16, 106 30 Z" fill="#FFB703" />
        {/* 腳 */}
        <Path d="M78 178 l-8 10 h18 z" fill="#FF8A3D" />
        <Path d="M122 178 l-8 10 h18 z" fill="#FF8A3D" />
        {/* 左邊翅膀（不動） */}
        <Ellipse cx="34" cy="118" rx="16" ry="26" fill="#FFC93C" transform="rotate(20 34 118)" />
        {/* 身體 */}
        <Circle cx="100" cy="108" r="76" fill="#FFD84D" />
        <Ellipse cx="100" cy="135" rx="46" ry="36" fill="#FFF1B8" />
        {/* 眼睛 */}
        <G>
          <AnimatedEllipse cx="72" cy="92" rx="11" ry={eyeRy} fill="#3A2E2A" />
          <AnimatedEllipse cx="128" cy="92" rx="11" ry={eyeRy} fill="#3A2E2A" />
          <Circle cx="76" cy="87" r="3.5" fill="#fff" />
          <Circle cx="132" cy="87" r="3.5" fill="#fff" />
        </G>
        {/* 腮紅 */}
        <Ellipse cx="55" cy="116" rx="12" ry="7" fill="#FF8FA3" opacity={0.7} />
        <Ellipse cx="145" cy="116" rx="12" ry="7" fill="#FF8FA3" opacity={0.7} />
        {/* 嘴巴（說話時張開） */}
        <AnimatedEllipse cx="100" cy="122" rx="13" ry={mouthRy} fill="#C2410C" />
        {/* 小嘴喙 */}
        <Path d="M90 108 L110 108 L100 118 Z" fill="#FF8A3D" />
      </Svg>
      {/* 右邊揮手的翅膀 */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 150 * s,
          top: 70 * s,
          width: 40 * s,
          height: 60 * s,
          transform: [{ translateY: 25 * s }, { rotate }, { translateY: -25 * s }],
        }}
      >
        <Svg width={40 * s} height={60 * s} viewBox="0 0 40 60">
          <Ellipse cx="20" cy="30" rx="15" ry="26" fill="#FFC93C" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
