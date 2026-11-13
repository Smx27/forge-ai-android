package com.forge

import android.graphics.Rect
import android.view.View
import android.view.ViewTreeObserver
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object KeyboardBridge {
    private var context: ReactApplicationContext? = null
    private var visible = false
    private var top = 0f

    private var installed: Pair<View, ViewTreeObserver.OnGlobalLayoutListener>? = null

    fun install(decor: View) {
        installed?.let { (view, listener) -> view.viewTreeObserver.removeOnGlobalLayoutListener(listener) }
        val frame = Rect()
        val listener = ViewTreeObserver.OnGlobalLayoutListener {
            decor.getWindowVisibleDisplayFrame(frame)
            val screen = decor.rootView.height
            val keyboard = screen - frame.bottom
            update(keyboard > screen * 0.15, frame.bottom / decor.resources.displayMetrics.density)
        }
        decor.viewTreeObserver.addOnGlobalLayoutListener(listener)
        installed = decor to listener
    }

    @Synchronized private fun update(isVisible: Boolean, topDp: Float) {
        if (isVisible == visible && (!isVisible || topDp == top)) return
        visible = isVisible
        top = topDp
        emit()
    }

    @Synchronized private fun emit() {
        val active = context ?: return
        if (!active.hasActiveReactInstance()) return
        val payload = Arguments.createMap().apply {
            putBoolean("visible", visible)
            putDouble("top", top.toDouble())
        }
        try { active.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("ForgeKeyboard", payload) } catch (_: RuntimeException) { }
    }

    @Synchronized fun attach(value: ReactApplicationContext) { context = value; if (visible) emit() }
    @Synchronized fun detach(value: ReactApplicationContext) { if (context === value) context = null }
}
