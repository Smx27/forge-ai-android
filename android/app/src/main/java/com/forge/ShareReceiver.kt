package com.forge

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

object ShareReceiver {
    private data class Share(val text: String?, val url: String?, val nonce: String, val action: String? = null, val chatId: String? = null) {
        fun map(): WritableMap = Arguments.createMap().apply {
            text?.let { putString("text", it) }
            url?.let { putString("url", it) }
            action?.let { putString("action", it) }
            chatId?.let { putString("chatId", it) }
            putString("nonce", nonce)
        }
    }
    private var pending: Share? = null
    private var context: ReactApplicationContext? = null

    @Synchronized fun receive(intent: Intent?) {
        if (intent == null) return
        val text: String?
        val url: String?
        when (intent.action) {
            "com.forge.NEW_CHAT" -> { deliver(Share(null, null, UUID.randomUUID().toString(), "new_chat")); return }
            "com.forge.OPEN_CHAT" -> {
                val chatId = intent.getStringExtra("chatId")?.take(64) ?: return
                deliver(Share(null, null, UUID.randomUUID().toString(), "open_chat", chatId)); return
            }
            Intent.ACTION_SEND -> {
                if (intent.type != "text/plain") return
                text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim()?.take(32768)?.takeIf { it.isNotEmpty() } ?: return
                if (text.startsWith("file:", true) || text.startsWith("content:", true)) return
                url = httpUrl(text)
            }
            Intent.ACTION_VIEW -> {
                url = httpUrl(intent.dataString ?: return) ?: return
                text = null
            }
            else -> return
        }
        deliver(Share(text, url, UUID.randomUUID().toString()))
    }

    private fun deliver(share: Share) {
        pending = share
        val active = context
        if (active?.hasActiveReactInstance() == true) {
            try {
                active.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("ForgeShare", share.map())
            } catch (_: RuntimeException) { }
        }
    }

    private fun httpUrl(value: String): String? {
        if (value.length > 8192 || value.any { it.isWhitespace() || it.isISOControl() }) return null
        val uri = Uri.parse(value)
        return value.takeIf { (uri.scheme.equals("http", true) || uri.scheme.equals("https", true)) && !uri.host.isNullOrBlank() && uri.userInfo == null }
    }

    @Synchronized fun attach(value: ReactApplicationContext) { context = value }
    @Synchronized fun detach(value: ReactApplicationContext) {
        if (context === value) context = null
    }
    @Synchronized fun consume(): WritableMap? = pending?.map().also { pending = null }
}

class ShareModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    init { ShareReceiver.attach(context); KeyboardBridge.attach(context) }
    override fun getName() = "ForgeShare"
    @ReactMethod fun getInitialShare(promise: Promise) { promise.resolve(ShareReceiver.consume()) }
    @ReactMethod fun addListener(eventName: String) = Unit
    @ReactMethod fun removeListeners(count: Double) = Unit
    override fun invalidate() { ShareReceiver.detach(context); KeyboardBridge.detach(context); super.invalidate() }
}
