# 🐥 上學小提醒（kids-reminder）

給國小孩子用的 Android 提醒 App。到了設定的時間，手機會跳出通知、**用中文念出提醒**，
並出現會跳、會揮手、會眨眼、說話時嘴巴會動的小黃雞「**嘟嘟**」，提醒孩子別忘了帶東西。

![嘟嘟](assets/icon.png)

## ✨ 功能

- 預設兩個提醒，**星期一到星期五**（上學日）每天響：
  | 時間 | 名稱 | 會說的話 |
  |---|---|---|
  | 07:00 | 早餐提醒 | 記得帶餐袋喔！ |
  | 18:30 | 回家提醒 | 記得把聯絡簿和功課拿出來喔！ |
- 每個提醒都可以修改：**要說的話、時間、星期幾、開／關**。
- 可以**新增**（例如「記得帶水壺喔！」「今天要穿體育服喔！」）或**刪除**提醒。
- 按「🔊 試聽」可以馬上聽聽看、看嘟嘟說話。
- 點通知打開 App，或 App 開著時通知到了，會出現**全螢幕嘟嘟畫面**、大字對話框，並把提醒念出來；按「**我知道了！**」關閉。
- 完全離線：資料只存在手機裡，不需要網路、不需要帳號。
- 按鈕大大的、字大大的，小朋友也會用。

## 📲 安裝 APK（Android 手機）

1. 用手機打開這個網址下載 APK：
   **https://github.com/caroelvis/kids-reminder/releases/latest/download/kids-reminder.apk**
   （或到本專案的 [Releases](https://github.com/caroelvis/kids-reminder/releases) 頁面，點 `kids-reminder.apk`，約 12 MB）
2. 下載完成後點開檔案。第一次會出現「為了安全，手機不允許安裝不明來源的應用程式」：
   點「**設定**」→ 打開「**允許這個來源**」（Chrome 或「檔案」App）→ 返回 → 點「**安裝**」。
   - 如果出現 Google Play 安全防護（Play Protect）的警告，點「**仍要安裝**」即可（因為這個 App 不是從 Play 商店下載的）。
3. 打開「上學小提醒」，出現「允許傳送通知？」時請按「**允許**」。
4. 往下捲到「給爸爸媽媽」，建議都設定一次：
   - **⏰ 允許準時鬧鐘**：打開「鬧鐘與提醒」，通知才會準時。
   - **🔋 關閉電池最佳化**：找到「上學小提醒」設為「不限制／不要最佳化」，避免手機省電時延後或吃掉通知。
   - **⏱️ 10 秒後測試通知**：按下後回到桌面，10 秒後應該會跳出通知。點通知就會看到嘟嘟說話。
5. 確認手機的**媒體音量**有打開（念提醒用的是媒體音量），而且手機有中文語音：
   設定 →「系統」→「語言與輸入」→「文字轉語音輸出」→ 選「Google 語音服務」，並安裝「中文（台灣）」語音資料。

## ✏️ 怎麼修改提醒

- **改內容／時間／星期**：在提醒卡片上按「✏️ 修改」→ 改好後按「💾 儲存」。
  - 時間：按大大的時間按鈕，會跳出時間選擇器。
  - 星期：點「一 二 三 四 五 六 日」，藍色代表會響。
- **暫時不要響**（例如放寒暑假）：把卡片右上角的開關關掉。
- **新增**：按「➕ 新增提醒」。
- **刪除**：按「✏️ 修改」→ 最下面「🗑️ 刪除這個提醒」。
- **回到原本的設定**：最下面「↩️ 恢復預設提醒」。

每次儲存後，App 會自動重新排好所有通知，不用重開。

## ⚠️ 已知限制

- **聲音什麼時候會念出來？** Android 不允許 App 在背景或螢幕關著時自己開口說話，所以：
  - App 沒開著時：會跳出**有鈴聲的通知**；**點通知**打開 App 後，嘟嘟才會出現並念出來。
  - App 開著（在畫面上）時：通知一到，嘟嘟會直接出現並念出來。
- 有些手機（小米、OPPO、vivo、華為、三星等）的**省電功能**可能讓通知延後或不出現，請一定要「關閉電池最佳化」，必要時在「自動啟動／背景執行」裡允許這個 App。
- 重新開機後通知會自動恢復；如果覺得怪怪的，打開 App 一次就會重新排程。
- 語音用的是手機內建的「文字轉語音」，聲音好不好聽要看手機；沒有中文語音資料時可能念不出來。
- 國定假日不會自動跳過（只看星期幾），放假時可以把提醒關掉。
- 從 v1.0.1 起 APK 只支援 64 位元 ARM 手機（arm64-v8a，近幾年的 Android 手機都是），檔案約 12 MB。
- 這個 APK 用除錯（debug）金鑰簽章，只適合自己家裡安裝，不能上架 Play 商店。
- 目前只做 Android；iOS 需要 Apple 開發者帳號才能安裝。

## 🧒 給初學者：每個檔案在做什麼？

| 檔案 | 說明 |
|---|---|
| `App.tsx` | 主畫面：提醒清單、試聽／修改按鈕、新增提醒、編輯視窗、給爸媽的設定按鈕。 |
| `src/storage.ts` | 定義「一個提醒」長什麼樣子，**預設的兩個提醒寫在這裡**，以及把資料存進手機（AsyncStorage）。 |
| `src/notifications.ts` | 建立 Android 通知頻道（高重要性＋鈴聲）、要求通知權限、把每個提醒依星期幾排成「每週重複」的通知。 |
| `src/speech.ts` | 用 `expo-speech` 以中文（zh-TW）把文字念出來。 |
| `src/Mascot.tsx` | 原創吉祥物「嘟嘟」：用 `react-native-svg` 畫的小黃雞，用 React Native `Animated` 做跳跳、揮手、眨眼、說話嘴巴動。 |
| `src/ReminderOverlay.tsx` | 全螢幕提醒畫面：嘟嘟＋對話框大字＋「我知道了！」按鈕。 |
| `app.json` | App 的名稱「上學小提醒」、套件名稱 `com.caroelvis.kidsreminder`、圖示、權限設定。 |
| `index.ts` | 程式進入點，啟動 `App`。 |
| `assets/` | App 圖示（嘟嘟）、通知小圖示、啟動畫面圖片。 |
| `package.json` | 用到的套件清單（Expo、expo-notifications、expo-speech…）。 |
| `docs/build-apk.yml` | GitHub Actions 自動打包 APK 的設定範本（要用時複製到 `.github/workflows/`）。 |

### 想改「預設」提醒？

打開 `src/storage.ts`，修改 `DEFAULT_REMINDERS` 裡的文字或時間，然後重新打包 APK。
（已經安裝過的手機會保留自己修改過的提醒；要套用新的預設，在 App 裡按「恢復預設提醒」。）

## 🛠️ 自己打包 APK

**方法一：用 GitHub 幫你打包（不用自己裝 Android 工具）**
先把 `docs/build-apk.yml` 複製到 `.github/workflows/build-apk.yml` 並推送到 GitHub
（可以直接在 GitHub 網頁上「Add file → Create new file」貼上內容）。
之後到本專案的 **Actions** 分頁 → 左邊選「Build APK」→「Run workflow」。
完成後在該次執行頁面最下面的 **Artifacts** 下載 `kids-reminder-apk`（解壓縮後就是 APK）。

**方法二：在自己的電腦打包**（需要 Node.js 20+、JDK 17、Android SDK）
```bash
npm install
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# 產出：android/app/build/outputs/apk/release/app-release.apk
```

**開發時預覽**：`npx expo run:android`（接上手機或模擬器）。
注意：Expo Go 不支援通知排程的完整功能，請用上面的方式打包測試。

## 技術

Expo SDK 57 · React Native · TypeScript · expo-notifications · expo-speech ·
@react-native-async-storage/async-storage · @react-native-community/datetimepicker · react-native-svg · expo-intent-launcher

嘟嘟是本專案原創角色，歡迎自由使用。
