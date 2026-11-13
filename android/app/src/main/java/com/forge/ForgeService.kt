package com.forge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class ForgeService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null

    private fun notification(title: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("forge_agent", "Agent activity", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, "forge_agent")
            .setSmallIcon(R.drawable.ic_stat_forge).setContentTitle("Forge is working")
            .setContentText(title).setContentIntent(open).setOngoing(true).build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title")?.take(120) ?: "Agent task in progress"
        if (Build.VERSION.SDK_INT >= 29) startForeground(8377, notification(title), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else startForeground(8377, notification(title))
        if (wakeLock?.isHeld != true) {
            wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "forge:agent")
            wakeLock?.acquire(30 * 60 * 1000L)
        }
        return START_NOT_STICKY
    }

    override fun onTimeout(startId: Int) { stopSelf() }

    override fun onDestroy() {
        if (wakeLock?.isHeld == true) wakeLock?.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
