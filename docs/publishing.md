# Publishing to Google Play

This is the production release checklist for Forge 1.0.0. Do the steps in order the first time; later releases only need steps 3 and 4.

## 1. Requirements

- JDK 17 or 21, Node 20+, Android SDK platform 36, build-tools 36.0.0, NDK 27.1.12297006.
- The app targets **API 36** (required for new apps and updates since August 31, 2026) and supports **16 KB memory pages** (required since November 1, 2025). Every native library is built and packaged with 16 KB alignment.
- The app ships **64-bit only** (arm64-v8a and x86_64). The on-device model runtime has no 32-bit build, so armeabi-v7a devices cannot install it. Play accepts this.

## 2. Create the upload key (once)

Run on your own computer, never on a shared machine:

```sh
./scripts/create-upload-key.sh            # default: ~/.forge/forge-upload.jks
```

The script creates an RSA-4096 key and writes `android/keystore.properties` (mode 600, git-ignored, excluded from source zips). Back up the .jks file and the password in a password manager.

In Play Console, create the app and **enrol in Play App Signing** (the default). Google keeps the app signing key; your key is only the upload key. If you lose it, Google can reset it after a support request.

## 3. Build the App Bundle

```sh
npm ci
cd android && ./gradlew clean bundleRelease
```

The bundle is at `android/app/build/outputs/bundle/release/app-release.aab`. `bundleRelease` stops with an error if `keystore.properties` is missing, so a debug-signed bundle can never be uploaded by mistake. Raise `versionCode` in `android/app/build.gradle` for every upload.

The bundle contains native debug symbols (SYMBOL_TABLE) so Play Console shows readable native crash stacks. R8 writes `android/app/build/outputs/mapping/release/mapping.txt`; Play picks it up from the bundle, but keep a copy of each release's mapping file to decode Java/Kotlin stack traces.

## 4. Test before upload

1. Upload to **Internal testing** first and install from Play on a real arm64 phone running Android 15 or 16.
2. Check: first launch after updating from a beta build (chats and settings still there), a cloud provider chat, an on-device model download and a short reply, Linux install and a command, backup export and restore, voice dictation, background download with the screen off.
3. Read **Pre-launch report** and **Android vitals** for crashes and policy warnings before promoting to Production.

## 5. App content declarations

- **Privacy policy URL.** The website workflow publishes [PRIVACY.md](../PRIVACY.md) at `https://<user>.github.io/<repo>/privacy` (see website/README.md). Replace the contact email with yours first.
- **Foreground service.** Forge declares `FOREGROUND_SERVICE_DATA_SYNC`. In App content → Foreground service permissions, choose *Data sync* and explain: *keeps an agent task or a user-started download (Linux system, model, skill) running while the app is in the background; it stops when the task ends.* Attach a short screen recording of a model download continuing in the background.
- **Microphone.** `RECORD_AUDIO` is requested at runtime only when the user taps the microphone, for speech-to-text dictation. Audio is handled by the system speech service and is never stored or sent by Forge.
- **AI-generated content.** Forge generates content with models the user selects. Users can regenerate answers and report content. Mention in the listing that output comes from third-party or on-device models.
- **Executable code.** Forge downloads an Alpine Linux root file system and runs user-requested commands in it through PRoot, inside the app sandbox. This is the same model as Termux-style terminal apps. It does not download code that changes the app's own behaviour (no dex or native library loading). Describe it plainly in the listing ("includes an optional Linux terminal") so review understands it. If review flags it, the fallback is to make the Linux environment an opt-in download behind a clear consent screen, which it already is.
- **Content rating.** Answer the questionnaire; Forge has user-generated AI content and unrestricted web access.
- **Target audience.** 18+ or 13+; not designed for children.
- **Ads.** No ads.
- **App access.** No login. Reviewers can use the app without credentials, but cloud chat needs a provider key; mention that on-device models work without one.

## 6. Data safety form

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No.** Nothing is sent to the developer. Messages sent to the AI provider the user configures with their own key are user-initiated and go directly to that provider. |
| Is all user data encrypted in transit? | **Yes.** Release builds block plain HTTP except to localhost / 127.0.0.1 (for a model server on the same phone). |
| Do you provide a way for users to request that their data be deleted? | **Yes.** Settings → Storage → Erase all data, deleting chats individually, or uninstalling. |
| Microphone / audio | Not collected. Used for dictation only, processed by the device speech service. |

If you add analytics, crash reporting or accounts, update both the form and the privacy policy first.

## 7. Security model

| Area | What Forge does |
| --- | --- |
| API keys and tokens | AES-256-GCM, key in Android Keystore (`forge_secrets`), stored in private SharedPreferences. |
| Chats, memory, settings | MMKV encrypted with a random 16-byte key, itself sealed with the Keystore key. Data from beta builds is re-encrypted on first launch. |
| Backups | AES-256-GCM, key from the user's password with PBKDF2-SHA256, 600,000 rounds (format FORGEBK2). Older FORGEBK1 backups still restore. |
| Android backup | `allowBackup=false` and data extraction rules exclude all data from cloud backup and device transfer. |
| Network | `usesCleartextTraffic=false`; network security config allows HTTP only to localhost. Debug builds additionally trust user CAs and 10.0.2.2. |
| Code | R8 shrinking and obfuscation, resource shrinking, verbose/debug/info logs and `console.*` removed from release, `debuggable false`, v2/v3 APK signing, dependency metadata block excluded. |
| Page preview | Local HTML previews can load files from their own folder only; file-to-file reads from scripts are blocked and links outside the folder open in the browser. |
| Archives | Zip and tar extraction reject paths and hard links that leave the target folder; zips are capped at 50,000 files and 2 GB. |
| Commands | Run only inside PRoot with the workspace mounted; there is no direct Android shell. Every command the agent runs follows the approval mode in Settings. |
| UI | Touches are ignored while another app draws over Forge (tapjacking). Lock-screen notifications hide chat content. |
| Debug vs release | Debug builds use the `com.forge.app.debug` id so they never overwrite or read the release install. |

Known limits: the Keystore protects data from other apps and from file copies, but not from a rooted device with the app unlocked. `npm audit --omit=dev` reports issues only in React Native CLI build tooling (image-size, fast-xml-parser); none of it ships in the app.

## 8. Size

Measured with `bundletool get-size total` on the 1.0.0 bundle:

| Device | Download size |
| --- | --- |
| arm64 phone | about 22.8 MB |
| x86_64 (emulators, Chromebooks) | about 12.4 MB |

The JS bundle is 1.9 MB (was 5.3 MB in the last beta). The largest remaining piece is the on-device model runtime (seven CPU-specific native builds). Moving it to a Play Feature Delivery module that downloads when the user first picks an on-device model would cut the install substantially; that is the next step if size matters more.

## 9. Licenses

The APK includes PRoot (GPL-2.0), talloc (LGPL-3.0) and libandroid-shmem (BSD) as separate executables from the Termux project. Keep [third_party/PROOT-NOTICE.md](../third_party/PROOT-NOTICE.md) and the in-app licenses screen, and provide the source links listed there.
