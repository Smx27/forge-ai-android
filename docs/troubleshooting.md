# Troubleshooting

**"Add a key" or 401 errors.** The key is missing, mistyped or revoked. Open the provider in Settings, paste a fresh key and tap **Test**.

**429 or "rate limit".** Free tiers limit requests per minute and per day. Wait, pick another free model, or switch provider.

**The model answers but never uses tools.** Some small or older models do not support tool calling. Pick a larger instruct model; on OpenRouter the `openrouter/free` router already prefers tool-capable models.

**Linux install fails.** It needs about 60 MB free and a connection to dl-cdn.alpinelinux.org. Retry from the Linux tab; partial downloads are cleaned up.

**`apk add` fails with a network error.** Run `apk update` first. Captive portals and some VPNs block the Alpine mirror.

**A command hangs.** Interactive programs wait for input that never comes. Tap stop and use non-interactive flags (`-y`, `--yes`, `CI=1`).

**On-device model is very slow or the app closes.** The model is too large for your phone's memory. Pick a smaller one (Qwen 2.5 0.5B is the lightest).

**A skill install says "rate limit".** GitHub limits anonymous API calls to 60 per hour. Wait and retry.

**A connector shows an error.** Check the URL ends in `/mcp` (or the server's documented path), add a token if the server requires one, then tap refresh.

**Local server cannot connect.** Use `http://127.0.0.1:<port>/v1` for a server on the phone; plain HTTP to other hosts is blocked for security, so expose remote servers over HTTPS.
