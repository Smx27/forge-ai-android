package com.forge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VoiceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var pending: Promise? = null
    private val timeout = Runnable { fail("VOICE_TIMEOUT", "Speech recognition timed out") }

    init { context.addLifecycleEventListener(this) }
    override fun getName() = "VoiceModule"

    @ReactMethod fun startListening(locale: String, promise: Promise) {
        main.post {
            if (pending != null) {
                promise.reject("VOICE_BUSY", "Speech recognition is already active")
                return@post
            }
            if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("VOICE_PERMISSION", "Microphone permission is required")
                return@post
            }
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                promise.reject("VOICE_UNAVAILABLE", "No speech recognition service is installed")
                return@post
            }
            pending = promise
            try {
                val active = SpeechRecognizer.createSpeechRecognizer(context)
                recognizer = active
                active.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) = Unit
                    override fun onBeginningOfSpeech() = Unit
                    override fun onRmsChanged(rmsdB: Float) = Unit
                    override fun onBufferReceived(buffer: ByteArray?) = Unit
                    override fun onEndOfSpeech() = Unit
                    override fun onPartialResults(partialResults: Bundle?) = Unit
                    override fun onEvent(eventType: Int, params: Bundle?) = Unit
                    override fun onError(error: Int) {
                        if (recognizer === active) fail("VOICE_ERROR_$error", "Speech recognition failed ($error)")
                    }
                    override fun onResults(results: Bundle?) {
                        if (recognizer !== active) return
                        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim()
                        if (text.isNullOrEmpty()) fail("VOICE_NO_RESULT", "No speech was recognized")
                        else {
                            val result = pending
                            pending = null
                            release()
                            result?.resolve(text)
                        }
                    }
                })
                active.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                })
                main.postDelayed(timeout, 60_000)
            } catch (error: Exception) {
                fail("VOICE_UNAVAILABLE", "Speech recognition could not start")
            }
        }
    }

    @ReactMethod fun cancelListening(promise: Promise) {
        main.post {
            fail("VOICE_CANCELLED", "Speech recognition cancelled")
            promise.resolve(null)
        }
    }

    private fun release() {
        main.removeCallbacks(timeout)
        val active = recognizer
        recognizer = null
        try { active?.cancel() } catch (_: Exception) { }
        try { active?.destroy() } catch (_: Exception) { }
    }

    private fun fail(code: String, message: String) {
        val result = pending
        pending = null
        release()
        result?.reject(code, message)
    }

    override fun onHostResume() = Unit
    override fun onHostPause() { main.post { fail("VOICE_CANCELLED", "Speech recognition interrupted") } }
    override fun onHostDestroy() { main.post { fail("VOICE_CANCELLED", "Speech recognition stopped") } }
    override fun invalidate() {
        context.removeLifecycleEventListener(this)
        main.post { fail("VOICE_CANCELLED", "Speech recognition disposed") }
        super.invalidate()
    }
}
