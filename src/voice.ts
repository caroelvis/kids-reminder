// 聲音：預先錄好的可愛女生聲音（assets/voice/*.mp3）、家長自己錄的聲音，
// 都沒有的時候才用手機的文字轉語音（expo-speech）。
import { AudioSource, preload, setAudioModeAsync } from 'expo-audio';

// 文字 → 內建語音檔。文字要「完全一樣」才會用內建語音。
// 這些語音是用微軟 Edge 的 zh-TW-HsiaoChenNeural 聲音（音調 +35Hz、語速 +10%，去掉前後靜音）事先產生的。
export const BUNDLED_CLIPS: Record<string, number> = {
  '記得帶餐袋喔！': require('../assets/voice/breakfast.mp3'),
  '記得把聯絡簿和功課拿出來喔！': require('../assets/voice/home.mp3'),
  '記得帶水壺喔！': require('../assets/voice/water.mp3'),
  '今天要穿體育服喔！': require('../assets/voice/pe.mp3'),
  '這是 10 秒後的測試通知喔！': require('../assets/voice/test.mp3'),
  '嗨！我是嘟嘟！': require('../assets/voice/hello.mp3'),
};

export const HELLO_TEXT = '嗨！我是嘟嘟！';

/** 找出這段提醒要播的聲音；沒有就回傳 null（改用文字轉語音） */
export function clipFor(text: string, voiceUri?: string): AudioSource | null {
  if (voiceUri) return { uri: voiceUri };
  const key = text.trim();
  return BUNDLED_CLIPS[key] ?? null;
}

let ready = false;
/** App 啟動時呼叫：設定播放模式、預先載入內建語音，讓播放幾乎沒有延遲 */
export async function initAudio() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      interruptionMode: 'duckOthers',
    });
  } catch {}
  for (const src of Object.values(BUNDLED_CLIPS)) {
    preload(src).catch(() => {});
  }
}
