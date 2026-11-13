# Changelog

## 1.1.0

### Push to GitHub
- **Publish source code as a new repository.** Git and GitHub → Push to GitHub (or long-press a folder in Files) imports a zip or takes a workspace folder, and creates a private or public repository on your account with the first commit pushed.
- **AI-prepared repository details.** Your current model suggests the repository name, a one-sentence description and up to ten GitHub topics from the file tree, manifests and README. Everything stays editable before you push.
- **.gitignore when it is missing.** The model writes one for the project's stack. Secret-looking files (.env, keystores, google-services.json, private keys) and dependency or build folders are always added, and the screen lists any secrets it found. Without a model, a stack template is used instead.
- Clear messages when the token cannot create repositories or the name is already taken.

## 1.0.0

First public release. Forge is now open source and ready for Google Play. This release includes everything from the beta builds below, plus a production security and compliance pass.

### Open source
- **Open-source licenses screen.** Settings → Open-source licenses now lists every component that ships in the app: the JavaScript packages taken from the actual release bundle, the Android libraries from the release build, and the bundled native programs and fonts. Search by name or license, and open any entry for its version, project page and full license text. `scripts/generate-licenses.mjs` rebuilds the list after dependency changes.

### Security
- **Chats, memory and settings are now encrypted on the phone.** App data is encrypted with a random key that is sealed by Android Keystore. Data from beta builds is encrypted automatically on first launch.
- **Stronger backup encryption.** New backups derive their key with 600,000 PBKDF2 rounds (was 120,000). Older backups still restore.
- Release builds block plain HTTP to anything except a server on the phone itself (localhost), and no longer trust user-installed certificates.
- Code is shrunk and obfuscated with R8, debug logging is stripped from release builds, and the app can no longer be debugged in release.
- Debug builds install as a separate app (`com.forge.app.debug`) and can never overwrite your release data.
- **Page previews are sandboxed.** A previewed HTML file can load its own scripts, styles and images, but can no longer read other files on the phone, and links that leave its folder open in your browser instead.
- Archive safety: a Linux system archive can no longer copy files from outside its own folder through hard links, and imported zips are limited to 50,000 files and 2 GB so a malicious zip cannot fill the phone.
- Commands only run inside the Linux sandbox; the unused path that ran shell commands directly on Android was removed.
- Taps are ignored while another app draws over Forge, so an overlay cannot trick you into approving a command.
- Notifications on the lock screen show only "Forge task finished", not the content of your chat.
- The HTTP client is updated to OkHttp 4.12 and Okio 3.9, which fixes a known denial-of-service bug in older Okio (CVE-2023-3635).
- A skill with no usable name can no longer wipe your other installed skills.
- Building a Play bundle now refuses to run without a real upload key, so a debug-signed bundle cannot be uploaded by mistake. `scripts/create-upload-key.sh` creates one.

### Google Play compliance
- Targets Android 16 (API 36), as Play requires for new apps and updates.
- Supports 16 KB memory pages: all native libraries are rebuilt and aligned for 16 KB, and an unused 32-bit library was removed.
- Opted out of predictive back for now so the back gesture keeps working the same way on Android 16.
- New production guide in [docs/publishing.md](docs/publishing.md): upload key and Play App Signing, foreground service and microphone declarations, Data safety answers, security model and pre-launch checks.

### Smaller app
- JavaScript bundle down from 5.3 MB to 1.9 MB: icons are imported one by one, only the Tamagui parts Forge uses are included, and a duplicated copy of the UI library is gone.
- Unused resources are removed at build time. Play download size is about 23 MB on arm64 phones.

### Website
- New project website in `website/` (Docusaurus): a landing page with a Google Play link, the full user guide with screenshots, the privacy policy at `/privacy` for Play Console, and the changelog. The **Website** GitHub Actions workflow builds it and deploys it to GitHub Pages on every push to `main` that changes the docs.

### Updated
- React Native 0.77, on-device model runtime (llama.rn) 0.7.2, MMKV 3.3, react-native-screens 4.6 and WebView 13.15.
- Text fields use the native input directly, with the same HUD styling.

## Beta history

Builds 4.0 to 4.3 were private betas. Their notes are kept here for reference.

### 4.3.0 (beta)

#### Changed
- **Sci-fi HUD interface.** A full visual redesign in a heads-up-display style, built with the UI/UX Pro Max design system (HUD / Sci-Fi FUI style, Tech/HUD Mono type pairing).
  - New near-black palette with neon cyan as the main signal colour, plus green, amber, red and violet status colours. A matching "daylight HUD" light theme keeps the same structure with darker cyan for contrast.
  - New type: Orbitron for screen titles and metrics, Share Tech Mono for labels, buttons, tabs and tags (uppercase, letter-spaced), Inter kept for chat and long text so answers stay easy to read.
  - Panels have square edges, 1px cyan lines and corner brackets. Buttons have cut corners. Section headers read like `// MODELS` with a trailing rule. Screens sit on a faint targeting grid.
  - Screen titles show a live `FORGE://` address with a pulsing status light. Sub-screen headers have an accent underline.
  - Tab bar: glowing top marker, bracketed icon for the active tab and mono labels.
  - Chat: your messages are panels tagged `> YOU` with a cyan edge, answers start with a `FORGE ▸` marker, tool steps and the plan are side-ruled log cards, and the message box is a bracketed console with a `›` prompt and a cut-corner send key.
  - Usage: the budget gauge has tick marks that light up as you use tokens, numbers are in Orbitron with a soft glow, and bars are square.
  - Dialogs, action sheets, toggles, fields, tabs, tags and progress bars all follow the same style.
- Pulsing lights respect the system's reduce motion setting.
- Tap targets in the message box grew to 40dp with extra touch area, and small buttons get extra touch area.

#### Fixed
- Forge closed when you changed the system font size, or when Android restored it after closing it in the background. It now restarts cleanly in both cases.

### 4.2.0 (beta)

#### Changed
- **New interface built on Tamagui.** Every screen, the tab bar and the shared components moved to Tamagui with a design token set, matched dark and light themes, Inter type scale and spring animations. Cards, rows, toggles, inputs and headers share one look, and the dark theme is deeper with softer tinted accents.
- **Usage dashboard.** Today's tokens with the change from yesterday and a ring against your daily budget; requests, success rate, tokens in and average response time; a stacked daily chart (tap a bar for exact numbers) or requests by hour for today; a 7-day activity heatmap; a provider donut and your top models.

#### Added
- **Edit and resend.** Long-press any message you sent to edit it. Sending replaces the answers that came after it.
- **Saved prompts with slash commands.** Type `/` in the message box to insert a saved prompt; the most used show first. Five starters (review, explain, tests, readme, commit) and a screen to add, edit and delete your own.
- **Automatic provider fallback.** When a provider returns a rate limit (429) or is down, Forge retries the step with another provider that has a key and shows a note in the chat. Toggle it in Usage and limits.
- **Daily token budget.** Pick 50k, 200k or 1M tokens per day. Forge sends a notification once when today goes over and shows a banner in chats.
- **Export chat as Markdown** from the chat menu, including the tools each step used.
- Encrypted backups now include saved prompts.

#### Fixed
- System alerts were replaced with themed dialogs and action sheets. Android alerts show at most three buttons, which hid **Delete chat** in the chat menu.
- The on-device models screen no longer says those models cannot use tools.

### 4.1.0 (beta)

#### Fixed
- **The keyboard no longer covers the chat.** Forge now measures the keyboard natively and keeps the message box, onboarding fields and every form above it. The tab bar steps aside while you type.
- Linux commands failed with `libtalloc.so.2 not found` after updating the app, because Android moves the native library folder on every update. The library link is now refreshed on each run.
- Tool cards could show the result of an earlier step when a model reused a tool call id from a previous turn. Each call now gets a unique id.

#### Added
- **Images in chat.** Attach photos or screenshots from the composer. Images are resized on the phone, shown in the conversation and sent to vision-capable models.
- **Git and GitHub.** Connect a fine-grained token, set your commit name and email, and clone repositories into the workspace. The agent can commit, pull and push from Linux.
- **Live dev server preview.** The agent can start long-running servers with `start_server`. The Linux tab lists background processes with their port, a preview button and a stop button; ending a terminal command with `&` runs it in the background. The preview has an address bar.
- **Project folders.** Point a chat at one folder of the workspace so each project stays separate. Export any folder as a zip and import zips from Files.
- **Undo file changes.** Every request records the files it changes. Undo restores them, including files the agent created.
- **Finish notifications.** When a task finishes while Forge is in the background, a notification opens the chat.
- **Tools for on-device models.** Models that support tool calling can read and write files and run Linux commands offline.
- **Usage.** Requests and tokens per provider for today, 7 and 30 days, with a 14-day chart.
- **Home screen widget, quick settings tile and app shortcuts** that open a new chat.
- **Encrypted backup.** Save chats, memory, settings, connectors and optionally keys to an AES-256-GCM file protected by your password, and restore it on another phone.

### 4.0.0 (beta)

A rebuild that turns the v3 demo shell into a working on-device app. Nothing depends on a desktop daemon any more.

#### Fixed
- **Crash on launch.** The v3 debug build expected a Metro packager and the UI depended on Tamagui without its compiler, Reanimated and Gesture Handler wiring that were never verified on a device. The app now ships as a release build with the JavaScript bundled by Hermes, a slimmer native dependency set, a root error boundary and a proper adaptive launcher icon.
- Proot launch, rootfs extraction, onboarding downloads and skill installs were stubs or timers. All of them now do real work.
- Removed references to classes that did not exist (`CronRegistry`) and receivers for features that could not run.

#### Added
- **On-device agent engine.** Streams answers from any OpenAI-compatible provider, calls tools in a loop, shows a live plan, and asks before acting according to your permission setting.
- **Free providers:** OpenRouter (including the `openrouter/free` router), Google Gemini, NVIDIA NIM, Groq, Cerebras, Mistral, Hugging Face Inference Providers, GitHub Models, a local OpenAI-compatible server (Ollama, LM Studio, llama.cpp) and any custom HTTPS endpoint. Each provider can list its live model catalog and test the connection.
- **On-device models** with llama.rn: Qwen 2.5 and 3, Gemma 3, Llama 3.2 in sizes from 0.5B to 4B, plus any GGUF link from Hugging Face. Downloads resume, are SHA-256 verified and can be cancelled.
- **Real Linux environment.** Alpine Linux minirootfs (latest stable, checksum verified) unpacked by a native tar reader and run with PRoot from the Termux project. A terminal tab with working directory tracking, quick commands and one-tap dev tools (git, Node.js, Python, build tools). The agent runs commands there through `run_command`.
- **Workspace files** shared by the agent, the Files tab and Linux (`/root/workspace`). Browse, create, edit, delete and preview HTML pages in a WebView.
- **Skill store** with 22 curated skills from Anthropic, Vercel, Paul Bakaus (Impeccable) and Superpowers, plus install from any GitHub URL. Skills download their SKILL.md and reference files; the agent loads them on demand.
- **MCP connectors** over Streamable HTTP with session handling, bearer tokens and a catalog of public servers (DeepWiki, Context7, Cloudflare Docs, Hugging Face, Exa, GitMCP).
- **Web search and fetch** tools, long-term memory with a management screen, custom instructions, creativity and step limits.
- Voice dictation, Android share-to-Forge, foreground service while the agent works, chat search, pinning, regenerate, copy and share.
- Privacy policy, terms of use and open-source license screens; erase-all-data control.

#### Polish
- File viewer renders each line with its own number so the gutter never drifts on long files.
- Tool cards show *waiting* while a step awaits your approval and *running* only while it executes; a chat shows only its latest plan.
- White switch thumbs, readable skill names, shorter catalog copy and full model ids in the composer chip.

#### Security
- API keys and connector tokens are encrypted with an AES-256-GCM key in Android Keystore.
- Cleartext HTTP is blocked except for localhost; cloud backup and device transfer are excluded for all app data.
- File tools are confined to the workspace; native file APIs refuse paths outside app storage; tar extraction rejects path traversal.
- Downloads require HTTPS and are checksum-verified where a checksum is published.
- Default permission mode edits files automatically and asks before every shell command.

#### Removed
- Mock bridge, scripted demo stream and fixtures.
- Desktop Node daemon and its WebSocket bridge, replaced by the on-device engine.
- Cron alarms, webhooks and the spec queue, which only worked with the daemon.
