# Forge on iPhone (Capacitor)

Phase 1 runs the existing Forge web app as a real iPhone app. It uses Capacitor 8, the same approach as Rocket Hop. The React/Vite code, screens and data model are the same ones the web app uses. A handful of native-only adjustments (listed below) keep web-only features from misbehaving inside the app. The web app itself is unchanged.

## Run it on your iPhone

**You need:**
- A Mac with Xcode. The one you use for Rocket Hop works, because Rocket Hop also uses Capacitor 8.
- Node.js 22 or newer. Check with `node -v`; Capacitor's command-line tool refuses to run on older versions.
- Your iPhone and its cable.

### In Terminal

```bash
# 1. Get the code: the first time…
cd ~/Developer                      # or wherever you keep projects
git clone https://github.com/gallojoey44-oss/75-hard.git
cd 75-hard
git checkout claude/ios-capacitor

#    …or, if you already have the repo:
cd ~/Developer/75-hard
git fetch origin
git checkout claude/ios-capacitor
git pull

# 2. Install dependencies
npm install

# 3. Build the web app
npm run build

# 4. Copy the build into the iOS project
npx cap sync ios

# 5. Open the project in Xcode
npx cap open ios
```

### In Xcode

6. **Wait for the packages to load.** The bar at the top shows "Resolving Package Graph" while Xcode downloads Capacitor from GitHub. The first time takes a minute or two.
7. **Select your Apple team.**
   1. In the left sidebar, click the blue **App** project.
   2. Under TARGETS, select **App**, then open **Signing & Capabilities**.
   3. Tick **Automatically manage signing**.
   4. Under **Team**, choose your Apple account, the same one you use for Rocket Hop.

   The bundle identifier is `com.josephgallo.forge`. If Xcode says it is not available, change it to something unique, such as `com.josephgallo.forge.app`.
8. **Connect the iPhone.** Plug it in, unlock it, and tap **Trust** if it asks. Developer Mode is already on if Rocket Hop runs. If it isn't, turn it on under Settings → Privacy & Security → Developer Mode; the phone restarts.
9. **Run.** In the device menu at the top centre of Xcode, choose your iPhone, then press ▶ (⌘R).
10. **First launch only.** If the iPhone says "Untrusted Developer", go to Settings → General → VPN & Device Management, tap your Apple account, then tap **Trust**. Open Forge again.

**After any change to the web code:** run `npm run build && npx cap sync ios`, then press ▶ in Xcode again. Running from Xcode again updates the app in place and keeps its data.

**Free Apple account:** an app installed with a free account stops opening after 7 days. Connect the phone and press ▶ again to renew it; your data stays.

## A fresh start

The iPhone app has its own storage, separate from Safari and from the web app on your Home Screen. It starts with no progress, and both profiles are available as usual. Nothing is migrated, and the web app's data is not read, changed or deleted.

Backup & Restore works in the app:
- **Export** opens the iPhone share sheet. Choose **Save to Files** to keep the backup.
- **Import** reads a backup file, in the same format the web app uses.

**Deleting the app from the phone deletes its data.** Export a backup first.

## What changed

| | |
| --- | --- |
| `capacitor.config.json` | App id `com.josephgallo.forge`, name Forge. Serves the Vite build (`dist`) on Forge's dark background, so there is no white flash. |
| `ios/` | The Xcode project. It uses Swift Package Manager, so there is no CocoaPods and no Podfile. iPhone runs in portrait only. The appearance is dark, so the keyboard, alerts and the share sheet match the app. The status bar text is white. Camera and photo-library permission messages cover progress photos. |
| `ios/App/App/Assets.xcassets` | The app icon and a dark launch screen, drawn from Forge's existing "75" artwork by `scripts/generate-ios-assets.mjs`. |
| `src/utils/platform.js` | `IS_NATIVE_APP`. It is true only inside the iPhone app, because Capacitor's native shell defines `window.Capacitor` before the page loads. It is false on the web, so every change below is inactive there. |
| Service worker (`swUtils.js`) | Not registered in the app, and "check for updates" reports unavailable. The app's code ships inside the app, and updates come from Xcode, later TestFlight. |
| Settings | Inside the app, the **Add to iPhone Home Screen** and **App Updates** sections are hidden. **Export** writes the backup with `@capacitor/filesystem` and hands it to the share sheet with `@capacitor/share`. A download link does nothing in an app's web view. The two plugins load only when Export is tapped, so the web app never loads them. |
| Notifications | Inside the app, the status reads **Not in the app yet**, and a note says the app doesn't send notifications for now. The Home Screen and Safari advice, the push checklist and the test buttons are hidden. Reminder choices can still be set and are saved. Nothing is sent to `/api/push`. Messages from your past self say the same. |
| Tests | `tests/ios-native-shell-e2e-test.mjs`. |

The PWA files (`manifest.json`, `sw.js`) are still copied into the app because they are part of the build, but the app never uses them.

## Check on the iPhone

These can't be tested without the device. The browser-based test simulates the native bridge, but it can't show these.

| Check | What to look for |
| --- | --- |
| Launch | A dark launch screen with the 75 icon, then the profile picker. No white flash. |
| Full screen and safe areas | The top of each screen clears the Dynamic Island. The tab bar clears the home indicator. The status bar text is white. |
| Touch and scrolling | Every tab scrolls smoothly, the whole app doesn't bounce, and taps respond straight away. |
| Tab navigation | Home, Today, Insights, Challenges, Settings. |
| Keyboard and text | Type in the Daily Log notes, a profile name and a Future Self letter. Each field stays visible above the keyboard, and the keyboard closes properly. |
| Modals and overlays | Start a challenge (setup steps), confirm dialogs, celebration screens, Mental Training. |
| Persistence | Log something, swipe Forge away in the app switcher, and reopen it. Then restart the phone and open Forge again. The data is still there both times. |
| Offline | Turn on Airplane Mode, then open and use Forge. Everything works, because nothing needs the network. |
| Dark theme and accents | The first profile is purple and the second is pink. |
| Backup | Export → Save to Files, then check the file appears in the Files app. Import that file and confirm the data is restored. |
| Progress photo | The camera permission prompt appears, the camera opens, and the photo is saved. |
| Rotation | The app stays in portrait. |

## Notifications: what still needs native work

Notifications don't work in the iPhone app yet, and the app says so. The app's web view has no Notification API, no service worker and no Web Push, so the web app's mechanism can't run there. The web app's notifications are unchanged.

| Feature | What it needs in the app |
| --- | --- |
| Timed reminders (habit reminders, quiet hours) | `@capacitor/local-notifications`, scheduled on the phone from the existing reminder plan (`buildReminderPlan`). They need to be rescheduled when habits, times or the challenge change. A local notification can't check whether a task is already done when it fires, which the web server does now, so it would use the date-independent wording or be rescheduled each time the app opens. |
| Messages from your past self | Also local notifications. The messages are already on the phone, so nothing would need to be uploaded. |
| Tapping a notification to open a screen | Handle the plugin's "action performed" event and navigate. This replaces the service worker's `FORGE_NAVIGATE`. |
| Notifications that must change while Forge is closed | Only if ever needed: push through Apple's service (APNs) with `@capacitor/push-notifications`, an Apple push key and a server to send them. No current feature requires this. |

Each of these has to be tested on the phone before it can be called working, especially delivery while the app is closed.

## Known limits

- **Storage.** Forge keeps its data in the web view's storage, as on the web. iOS keeps that storage through app restarts and through updates from Xcode. Deleting the app deletes it, and iOS can clear web-view storage when the phone is critically short of space. Until a later phase moves the data into native storage, export a backup from time to time.
- **Updates.** Deploying the web app doesn't change the iPhone app. A new version means a new build from Xcode, and later TestFlight or the App Store.
- **iPad.** The project allows iPad, which is Capacitor's default, but only iPhone has been set up.
