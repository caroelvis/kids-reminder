// 用手機的語音（中文）把提醒念出來
import * as Speech from 'expo-speech';

export function speak(text: string, onStart?: () => void, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: 'zh-TW',
    rate: 0.9,
    pitch: 1.15,
    onStart,
    onDone,
    onStopped: onDone,
    onError: () => onDone?.(),
  });
}

export function stopSpeaking() {
  Speech.stop();
}
