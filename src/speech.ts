// 文字轉語音（沒有內建語音或錄音時才會用到）
import * as Speech from 'expo-speech';

let voiceId: string | undefined;

/**
 * App 啟動時先「暖機」：找一個裝在手機裡的中文語音（不用網路的比較快），
 * 並用音量 0 先念一個字，讓語音引擎先準備好，之後念提醒就不會慢好幾秒。
 */
export async function warmUpSpeech() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const zh = voices.filter((v) => /zh[-_]TW|cmn[-_]TW|zh[-_]Hant/i.test(v.language) || /cmn-tw/i.test(v.identifier));
    const local = zh.filter((v) => !/network/i.test(v.identifier));
    voiceId = (local[0] ?? zh[0])?.identifier;
  } catch {}
  try {
    Speech.speak('嗯', { language: 'zh-TW', voice: voiceId, volume: 0, rate: 2 });
  } catch {}
}

/**
 * 念出文字。onDone：正常念完；onStopped：被中斷（例如按了「我知道了！」）。
 */
export function speak(text: string, onStart?: () => void, onDone?: () => void, onStopped?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: 'zh-TW',
    voice: voiceId,
    rate: 1.05,
    pitch: 1.5,
    onStart,
    onDone,
    onStopped: onStopped ?? onDone,
    onError: () => onDone?.(),
  });
}

export function stopSpeaking() {
  Speech.stop();
}
