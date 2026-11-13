# Forge Privacy Policy

**Effective date:** November 12, 2026<br />
**App:** Forge (package `com.forge.app`)<br />
**Contact:** support@forge.app

Forge is an AI assistant that runs on your Android device. This policy explains what data the app handles, where it goes, and which Android permissions it requests and why.

## Summary

- We, the developer, **do not collect, store or sell any personal data.** Forge has no accounts, no analytics, no advertising and no tracking SDKs, and we run no servers that receive your content.
- Your chats, files, memory, settings and API keys are stored **only on your device**.
- Data leaves your device **only when you use a feature that needs it**, and only to the service you chose (for example the AI provider whose key you entered).

## Data stored on your device

| Data | Purpose | Protection |
| --- | --- | --- |
| Conversations, memory, custom instructions, settings | Show your history and personalize answers | App-private storage, encrypted at rest (AES) with a key sealed by Android Keystore |
| API keys and connector tokens | Authenticate with services you configure | Encrypted with AES-256-GCM using a key held in Android Keystore |
| Workspace files, downloaded models, Linux environment, installed skills | Let the agent create and run files, run offline models and use skills | App-private storage |
| Images you attach to a message | Show them in the chat and send them to the model | A resized copy in app-private storage, deleted with the chat |
| Undo checkpoints | Restore files the agent changed | Copies of the changed files in app-private storage, deleted with the chat |
| GitHub token (if you connect GitHub) | Let git clone, pull and push | Encrypted in Android Keystore; a copy in the Linux environment's git credential file in app-private storage. Disconnecting removes both |
| Usage counts | Show requests, tokens, response times and models used per day, and the daily budget | App-private storage, encrypted at rest |
| Saved prompts | Insert reusable prompts with slash commands | App-private storage, encrypted at rest, included in encrypted backups |

Android cloud backup and device-to-device transfer are **disabled** for all app data. Uninstalling Forge deletes everything. You can also delete individual chats, memories and files, or use **Settings → Storage → Erase all data**.

## Data sent to third parties, only when you use the feature

| Feature | What is sent | Recipient |
| --- | --- | --- |
| Chatting with a cloud model | Your messages, images you attach, custom instructions, relevant memories, and file contents or tool results the agent uses | The provider you selected with your own key (e.g. OpenRouter, Google Gemini, NVIDIA, Groq, Cerebras, Mistral, Hugging Face, GitHub Models, or a custom endpoint) |
| On-device models | Nothing; processing happens on your phone | None |
| Web search and browsing (can be turned off) | Search queries and URLs | DuckDuckGo and the websites opened |
| Connectors (MCP) | Tool names and arguments the agent sends | The connector server you added |
| Git and GitHub (optional) | Your token and the repositories you clone or push | GitHub, or the git host in the URL you enter |
| Downloads | Standard HTTPS requests (IP address, user agent) | GitHub (skills), Hugging Face (models), Alpine Linux mirrors (Linux system and packages) |
| Voice dictation | Audio | Your device's speech recognition service (e.g. Google), under its own policy; Forge does not record or store audio |

These services process data under their own privacy policies. Review them before entering a key. All network traffic uses HTTPS, except connections you configure to a server on your own device (localhost).

## Android permissions

| Permission | Why Forge needs it | When it is used |
| --- | --- | --- |
| `INTERNET` | Talk to AI providers, search the web, use connectors, download skills, models and Linux packages | When you use those features |
| `ACCESS_NETWORK_STATE` | Detect when you are offline and show a clear message instead of failing | While the app runs |
| `RECORD_AUDIO` (microphone) | Voice dictation into the message box | Only after you tap the microphone and grant the permission; you can deny it and type instead |
| `POST_NOTIFICATIONS` | Show a notification while the agent or a download is working in the background, and when a task finishes (Android 13+) | During background tasks; optional, and the finish notification can be turned off in Settings |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` | Keep a task you started (an agent run or a download of a model, skill or the Linux system) running when you switch apps | Only while that task runs; stops automatically |
| `WAKE_LOCK` | Prevent the CPU from sleeping in the middle of such a task | Only while that task runs |

Forge does **not** request access to your contacts, location, camera, photo library, files outside the app, phone, SMS or accounts. When you attach an image, import a zip or restore a backup, Android's system picker gives Forge only the file you choose; when you export a zip or save a backup, it writes only to the location you choose.

## Backups

Backup files are created only when you ask. They are encrypted with AES-256-GCM using a key derived from your password (PBKDF2-SHA256, 600,000 rounds) and saved to the location you pick. Forge never uploads them and cannot recover a forgotten password. API keys are included only if you leave that option on.

## Home screen widget and quick settings tile

The widget and tile only open Forge to a new chat. They show no content and read no data. Text you share to Forge from another app with Android's share sheet is placed in a new chat and handled like any message you type.

## Children

Forge is not directed to children under 13 (or the minimum age in your country), and we do not knowingly collect data from children.

## Security

Keys are encrypted with hardware-backed Android Keystore where available. File tools are confined to the app's workspace, and the Linux environment runs in an unprivileged sandbox inside app storage. No method of storage or transmission is completely secure, so keep your device locked and revoke keys you no longer use.

## Your rights

Because we hold no personal data about you, there is nothing for us to access, correct or delete on our side. All data is under your control on your device. For data held by a provider you use, contact that provider.

## Changes

We will update this page and the effective date when the policy changes. Material changes will also be shown in the app.

## Contact

Questions about this policy: **support@forge.app**
