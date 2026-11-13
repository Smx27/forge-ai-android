package com.forge

import android.content.Context
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReadableArray
import java.security.SecureRandom
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import android.os.Build
import android.os.StatFs
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.system.Os
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.GZIPInputStream
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class ForgeNativeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val io = Executors.newCachedThreadPool()
    private val processes = ConcurrentHashMap<String, Process>()
    private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()

    override fun getName() = "ForgeNative"

    private val filesRoot: File get() = context.filesDir.canonicalFile
    private val cacheRoot: File get() = context.cacheDir.canonicalFile
    private val nativeLibDir: File get() = File(context.applicationInfo.nativeLibraryDir)
    private val rootfs: File get() = File(filesRoot, "linux/rootfs")
    private val workspace: File get() = File(filesRoot, "workspace").apply { mkdirs() }

    override fun getConstants(): MutableMap<String, Any> = hashMapOf(
        "filesDir" to filesRoot.absolutePath,
        "cacheDir" to cacheRoot.absolutePath,
        "workspaceDir" to workspace.absolutePath,
        "rootfsDir" to rootfs.absolutePath,
        "modelsDir" to File(filesRoot, "models").apply { mkdirs() }.absolutePath,
        "abi" to (Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"),
        "sdkInt" to Build.VERSION.SDK_INT,
        "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
        "appVersion" to BuildConfig.VERSION_NAME,
        "storageKey" to storageKey.first,
        "storageKeyFresh" to storageKey.second,
    )

    private val storageKey: Pair<String, Boolean> by lazy {
        val store = context.getSharedPreferences("forge_storage", Context.MODE_PRIVATE)
        store.getString("key", null)?.let { sealed ->
            try {
                val bytes = Base64.decode(sealed, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, bytes, 0, 12)) }
                return@lazy String(cipher.doFinal(bytes, 12, bytes.size - 12)) to false
            } catch (_: Exception) { }
        }
        val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#%&()*+,-./:;<=>?@[]^_{|}~"
        val random = SecureRandom()
        val key = String(CharArray(16) { alphabet[random.nextInt(alphabet.length)] })
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        store.edit().putString("key", Base64.encodeToString(cipher.iv + cipher.doFinal(key.toByteArray()), Base64.NO_WRAP)).commit()
        key to true
    }

    private fun emit(event: String, map: WritableMap) {
        if (!context.hasActiveReactInstance()) return
        try { context.emitDeviceEvent(event, map) } catch (_: RuntimeException) { }
    }

    private fun safe(path: String): File {
        val file = File(path).canonicalFile
        val ok = listOf(filesRoot, cacheRoot).any { root -> file.path == root.path || file.path.startsWith(root.path + File.separator) }
        if (!ok) throw SecurityException("Path is outside app storage")
        return file
    }

    private fun background(promise: Promise, code: String, block: () -> Any?) {
        io.execute {
            try { promise.resolve(block()) } catch (error: Throwable) { promise.reject(code, error.message ?: error.javaClass.simpleName, error) }
        }
    }

    @ReactMethod fun addListener(eventName: String) = Unit
    @ReactMethod fun removeListeners(count: Double) = Unit

    @ReactMethod fun readFile(path: String, promise: Promise) = background(promise, "FS_READ") {
        val file = safe(path)
        if (file.length() > 8L * 1024 * 1024) throw IllegalStateException("File is larger than 8 MB")
        file.readText()
    }

    @ReactMethod fun writeFile(path: String, content: String, promise: Promise) = background(promise, "FS_WRITE") {
        val file = safe(path)
        file.parentFile?.mkdirs()
        val temp = File(file.parentFile, ".${file.name}.tmp")
        temp.writeText(content)
        if (!temp.renameTo(file)) { file.writeText(content); temp.delete() }
        true
    }

    @ReactMethod fun listDir(path: String, promise: Promise) = background(promise, "FS_LIST") {
        val dir = safe(path)
        val out = Arguments.createArray()
        dir.listFiles()?.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))?.forEach { child ->
            out.pushMap(Arguments.createMap().apply {
                putString("name", child.name)
                putString("path", child.absolutePath)
                putBoolean("isDir", child.isDirectory)
                putDouble("size", child.length().toDouble())
                putDouble("mtime", child.lastModified().toDouble())
            })
        }
        out
    }

    @ReactMethod fun stat(path: String, promise: Promise) = background(promise, "FS_STAT") {
        val file = safe(path)
        if (!file.exists()) null else Arguments.createMap().apply {
            putBoolean("isDir", file.isDirectory)
            putDouble("size", file.length().toDouble())
            putDouble("mtime", file.lastModified().toDouble())
        }
    }

    @ReactMethod fun mkdir(path: String, promise: Promise) = background(promise, "FS_MKDIR") { safe(path).mkdirs(); true }

    @ReactMethod fun remove(path: String, promise: Promise) = background(promise, "FS_REMOVE") {
        val file = safe(path)
        if (file == filesRoot || file == cacheRoot) throw SecurityException("Refusing to delete an app root")
        deleteTree(file)
        true
    }

    @ReactMethod fun rename(from: String, to: String, promise: Promise) = background(promise, "FS_RENAME") {
        val target = safe(to)
        target.parentFile?.mkdirs()
        if (!safe(from).renameTo(target)) throw IllegalStateException("Could not rename")
        true
    }

    @ReactMethod fun dirSize(path: String, promise: Promise) = background(promise, "FS_SIZE") {
        val root = safe(path)
        var total = 0L
        if (root.exists()) root.walkTopDown().onEnter { !isSymlink(it) || it == root }.forEach { if (it.isFile && !isSymlink(it)) total += it.length() }
        total.toDouble()
    }

    @ReactMethod fun storageInfo(promise: Promise) = background(promise, "STORAGE") {
        val stat = StatFs(filesRoot.path)
        Arguments.createMap().apply {
            putDouble("free", stat.availableBytes.toDouble())
            putDouble("total", stat.totalBytes.toDouble())
            val memory = android.app.ActivityManager.MemoryInfo()
            (context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).getMemoryInfo(memory)
            putDouble("ramAvailable", memory.availMem.toDouble())
            putDouble("ramTotal", memory.totalMem.toDouble())
        }
    }

    private fun isSymlink(file: File): Boolean = try {
        android.system.Os.lstat(file.path).st_mode and 0xF000 == 0xA000
    } catch (_: Exception) { false }

    private fun deleteTree(file: File) {
        if (isSymlink(file)) { file.delete(); return }
        if (file.isDirectory) {
            file.listFiles()?.forEach { child ->
                if (!isSymlink(child) && child.isDirectory && !child.canWrite()) child.setWritable(true)
                deleteTree(child)
            }
            file.setWritable(true)
        }
        file.delete()
    }

    @ReactMethod fun download(id: String, url: String, dest: String, sha256: String?, promise: Promise) {
        val flag = AtomicBoolean(false)
        cancelled[id] = flag
        background(promise, "DOWNLOAD") {
            try {
                val target = safe(dest)
                target.parentFile?.mkdirs()
                val partial = File(target.path + ".part")
                var connection: HttpURLConnection
                var location = URL(url)
                var redirects = 0
                while (true) {
                    if (location.protocol != "https") throw SecurityException("Downloads must use HTTPS")
                    connection = (location.openConnection() as HttpURLConnection).apply {
                        instanceFollowRedirects = false
                        connectTimeout = 20_000
                        readTimeout = 60_000
                        setRequestProperty("User-Agent", "Forge/${BuildConfig.VERSION_NAME} (Android)")
                        if (partial.exists() && partial.length() > 0) setRequestProperty("Range", "bytes=${partial.length()}-")
                    }
                    val code = connection.responseCode
                    if (code in 300..399) {
                        val next = connection.getHeaderField("Location") ?: throw IllegalStateException("Redirect without location")
                        connection.disconnect()
                        location = URL(location, next)
                        if (++redirects > 8) throw IllegalStateException("Too many redirects")
                        continue
                    }
                    if (code !in 200..299) throw IllegalStateException("Server answered HTTP $code")
                    break
                }
                val resumed = connection.responseCode == 206
                if (!resumed) partial.delete()
                val offset = if (resumed) partial.length() else 0L
                val length = connection.contentLengthLong
                val total = if (length > 0) offset + length else -1L
                var received = offset
                var last = 0L
                connection.inputStream.use { input ->
                    FileOutputStream(partial, resumed).use { output ->
                        val buffer = ByteArray(256 * 1024)
                        while (true) {
                            if (flag.get()) throw InterruptedException("Download cancelled")
                            val read = input.read(buffer)
                            if (read < 0) break
                            output.write(buffer, 0, read)
                            received += read
                            val now = System.currentTimeMillis()
                            if (now - last > 250) {
                                last = now
                                emit("ForgeDownload", Arguments.createMap().apply {
                                    putString("id", id); putDouble("received", received.toDouble()); putDouble("total", total.toDouble())
                                })
                            }
                        }
                    }
                }
                if (!sha256.isNullOrBlank()) {
                    val actual = hashFile(partial)
                    if (!actual.equals(sha256.trim(), true)) { partial.delete(); throw SecurityException("Checksum mismatch: the download was corrupted or tampered with") }
                }
                target.delete()
                if (!partial.renameTo(target)) throw IllegalStateException("Could not finalize the download")
                emit("ForgeDownload", Arguments.createMap().apply {
                    putString("id", id); putDouble("received", received.toDouble()); putDouble("total", received.toDouble()); putBoolean("done", true)
                })
                target.absolutePath
            } finally { cancelled.remove(id) }
        }
    }

    @ReactMethod fun cancelDownload(id: String, promise: Promise) { cancelled[id]?.set(true); promise.resolve(true) }

    private fun hashFile(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) { val read = input.read(buffer); if (read < 0) break; digest.update(buffer, 0, read) }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    @ReactMethod fun extractTarGz(archive: String, dest: String, promise: Promise) = background(promise, "EXTRACT") {
        val source = safe(archive)
        val target = safe(dest)
        if (target.exists()) deleteTree(target)
        target.mkdirs()
        var count = 0
        TarReader(GZIPInputStream(BufferedInputStream(FileInputStream(source), 256 * 1024))).use { tar ->
            while (true) {
                val entry = tar.next() ?: break
                val name = entry.name.trimStart('/').removePrefix("./")
                if (name.isEmpty()) { tar.skip(entry); continue }
                val out = File(target, name).canonicalFile
                if (!out.path.startsWith(target.path + File.separator) && out.path != target.path) { tar.skip(entry); continue }
                when (entry.type) {
                    '5' -> { out.mkdirs(); chmod(out, entry.mode or 0b111_000_000) }
                    '2' -> {
                        out.parentFile?.mkdirs()
                        if (out.exists() || isSymlink(out)) out.delete()
                        Os.symlink(entry.link, out.path)
                    }
                    '1' -> {
                        val linked = File(target, entry.link.trimStart('/').removePrefix("./")).canonicalFile
                        if (!linked.path.startsWith(target.path + File.separator)) { tar.skip(entry); continue }
                        out.parentFile?.mkdirs()
                        if (linked.exists()) { linked.copyTo(out, true); chmod(out, entry.mode) }
                    }
                    '0', '\u0000', '7' -> {
                        out.parentFile?.mkdirs()
                        if (isSymlink(out)) out.delete()
                        FileOutputStream(out).use { tar.copyTo(entry, it) }
                        chmod(out, entry.mode or 0b110_000_000)
                    }
                    else -> tar.skip(entry)
                }
                if (++count % 200 == 0) emit("ForgeExtract", Arguments.createMap().apply { putInt("files", count) })
            }
        }
        count
    }

    private fun chmod(file: File, mode: Int) { try { Os.chmod(file.path, mode and 0xFFF) } catch (_: Exception) { } }

    private fun linuxEnvironment(): Pair<String, Map<String, String>> {
        val proot = File(nativeLibDir, "libproot.so")
        if (!proot.exists()) throw IllegalStateException("This build does not include the Linux runtime for ${Build.SUPPORTED_ABIS.firstOrNull()}")
        val links = File(filesRoot, "linux/lib").apply { mkdirs() }
        val talloc = File(links, "libtalloc.so.2")
        val tallocTarget = File(nativeLibDir, "libtalloc.so").path
        val current = try { Os.readlink(talloc.path) } catch (_: Exception) { null }
        if (current != tallocTarget) {
            if (current != null || talloc.exists()) talloc.delete()
            Os.symlink(tallocTarget, talloc.path)
        }
        val tmp = File(cacheRoot, "proot-tmp").apply { mkdirs() }
        val env = mutableMapOf(
            "PROOT_TMP_DIR" to tmp.path,
            "PROOT_LOADER" to File(nativeLibDir, "libproot-loader.so").path,
            "LD_LIBRARY_PATH" to "${links.path}:${nativeLibDir.path}",
        )
        val loader32 = File(nativeLibDir, "libproot-loader32.so")
        if (loader32.exists()) env["PROOT_LOADER_32"] = loader32.path
        return proot.path to env
    }

    @ReactMethod fun linuxStatus(promise: Promise) = background(promise, "LINUX") {
        Arguments.createMap().apply {
            putBoolean("runtime", File(nativeLibDir, "libproot.so").exists())
            putBoolean("installed", File(rootfs, "bin/sh").exists() || isSymlink(File(rootfs, "bin/sh")))
            putString("release", File(rootfs, "etc/alpine-release").takeIf { it.exists() }?.readText()?.trim())
        }
    }

    private fun linuxBuilder(command: String, cwd: String?, envMap: Map<String, Any?>): ProcessBuilder {
        if (!File(rootfs, "bin").exists()) throw IllegalStateException("The Linux environment is not installed yet")
        val (proot, env) = linuxEnvironment()
        val guestCwd = cwd ?: "/root/workspace"
        val args = mutableListOf(proot, "--kill-on-exit", "--link2symlink", "-0", "-r", rootfs.path,
            "-b", "/dev", "-b", "/proc", "-b", "/sys", "-b", "/dev/urandom:/dev/random",
            "-b", File(rootfs, "tmp").path + ":/dev/shm", "-b", workspace.path + ":/root/workspace",
            "-w", guestCwd, "/usr/bin/env", "-i", "HOME=/root", "USER=root", "TERM=xterm-256color", "LANG=C.UTF-8",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "TMPDIR=/tmp")
        envMap.forEach { (key, value) -> if (key.matches(Regex("[A-Za-z_][A-Za-z0-9_]*"))) args.add(key + "=" + value) }
        args.addAll(listOf("/bin/sh", "-lc", command))
        val builder = ProcessBuilder(args)
        builder.environment().clear()
        builder.environment().putAll(env)
        builder.environment()["HOME"] = filesRoot.path
        builder.environment()["PATH"] = "/system/bin"
        return builder
    }

    @ReactMethod fun exec(id: String, command: String, options: ReadableMap, promise: Promise) {
        val cwd = if (options.hasKey("cwd")) options.getString("cwd") else null
        val timeoutMs = if (options.hasKey("timeoutMs")) options.getDouble("timeoutMs").toLong() else 120_000L
        val envMap = if (options.hasKey("env")) options.getMap("env")?.toHashMap() ?: hashMapOf() else hashMapOf<String, Any?>()
        background(promise, "EXEC") {
            val builder = linuxBuilder(command, cwd, envMap)
            builder.redirectErrorStream(true)
            val process = builder.start()
            processes[id] = process
            val tail = StringBuilder()
            val reader = Thread {
                try {
                    val input: InputStream = process.inputStream
                    val buffer = ByteArray(8192)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        val chunk = String(buffer, 0, read)
                        synchronized(tail) { tail.append(chunk); if (tail.length > 65536) tail.delete(0, tail.length - 65536) }
                        emit("ForgeExec", Arguments.createMap().apply { putString("id", id); putString("data", chunk) })
                    }
                } catch (_: Exception) { }
            }
            reader.start()
            val finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
            if (!finished) process.destroyForcibly()
            reader.join(2000)
            processes.remove(id)
            Arguments.createMap().apply {
                putInt("exitCode", if (finished) process.exitValue() else -1)
                putBoolean("timedOut", !finished)
                putString("output", synchronized(tail) { tail.toString() })
            }
        }
    }

    @ReactMethod fun kill(id: String, promise: Promise) {
        processes.remove(id)?.destroyForcibly()
        promise.resolve(true)
    }

    private val prefs get() = context.getSharedPreferences("forge_secure", Context.MODE_PRIVATE)

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getEntry("forge_secrets", null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder("forge_secrets", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return generator.generateKey()
    }

    @ReactMethod fun secureSet(key: String, value: String, promise: Promise) = background(promise, "SECURE") {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        val sealed = cipher.iv + cipher.doFinal(value.toByteArray())
        prefs.edit().putString(key, Base64.encodeToString(sealed, Base64.NO_WRAP)).commit()
        true
    }

    @ReactMethod fun secureGet(key: String, promise: Promise) = background(promise, "SECURE") {
        val stored = prefs.getString(key, null) ?: return@background null
        try {
            val sealed = Base64.decode(stored, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, sealed, 0, 12)) }
            String(cipher.doFinal(sealed, 12, sealed.size - 12))
        } catch (_: Exception) { prefs.edit().remove(key).commit(); null }
    }

    @ReactMethod fun secureDelete(key: String, promise: Promise) = background(promise, "SECURE") { prefs.edit().remove(key).commit(); true }

    @ReactMethod fun secureClear(promise: Promise) = background(promise, "SECURE") { prefs.edit().clear().commit(); true }

    @ReactMethod fun setAgentService(active: Boolean, title: String, promise: Promise) {
        try {
            val intent = android.content.Intent(context, ForgeService::class.java).putExtra("title", title)
            if (active) context.startForegroundService(intent) else context.stopService(intent)
            promise.resolve(true)
        } catch (error: Exception) { promise.resolve(false) }
    }

    @ReactMethod fun copyText(text: String, promise: Promise) {
        try {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Forge", text))
            promise.resolve(true)
        } catch (error: Exception) { promise.resolve(false) }
    }


    private val pendingResults = ConcurrentHashMap<Int, (Int, Intent?) -> Unit>()
    private val requestCounter = java.util.concurrent.atomic.AtomicInteger(7300)

    init {
        context.addActivityEventListener(object : BaseActivityEventListener() {
            override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
                pendingResults.remove(requestCode)?.invoke(resultCode, data)
            }
        })
    }

    private fun launchForResult(intent: Intent, promise: Promise, onResult: (Uri) -> Any?) {
        val activity = currentActivity ?: run { promise.reject("NO_ACTIVITY", "Open Forge and try again"); return }
        val code = requestCounter.incrementAndGet()
        pendingResults[code] = { resultCode, data ->
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) promise.resolve(null)
            else io.execute { try { promise.resolve(onResult(uri)) } catch (error: Throwable) { promise.reject("DOCUMENT", error.message ?: error.javaClass.simpleName, error) } }
        }
        try { activity.startActivityForResult(intent, code) } catch (error: Exception) {
            pendingResults.remove(code)
            promise.reject("DOCUMENT", "No app on this phone can open that", error)
        }
    }

    private fun displayName(uri: Uri): String? = try {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    } catch (_: Exception) { null }

    @ReactMethod fun pickImage(promise: Promise) {
        val intent = Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE)
        launchForResult(intent, promise) { uri -> saveImage(uri) }
    }

    private fun saveImage(uri: Uri): WritableMap {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IllegalArgumentException("That file is not an image Forge can read")
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 1600) sample *= 2
        var bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
            ?: throw IllegalArgumentException("Could not decode the image")
        val rotation = try {
            resolver.openInputStream(uri)?.use { stream ->
                when (ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                    else -> 0f
                }
            } ?: 0f
        } catch (_: Exception) { 0f }
        val scale = minOf(1f, 1600f / maxOf(bitmap.width, bitmap.height))
        if (scale < 1f || rotation != 0f) {
            val matrix = Matrix().apply { postScale(scale, scale); postRotate(rotation) }
            bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        }
        val dir = File(filesRoot, "attachments").apply { mkdirs() }
        val file = File(dir, "img_" + System.currentTimeMillis() + ".jpg")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
        return Arguments.createMap().apply {
            putString("path", file.absolutePath)
            putInt("width", bitmap.width)
            putInt("height", bitmap.height)
        }
    }

    @ReactMethod fun readBase64(path: String, promise: Promise) = background(promise, "FS_READ") {
        val file = safe(path)
        if (file.length() > 12L * 1024 * 1024) throw IllegalArgumentException("File is too large")
        Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
    }

    @ReactMethod fun copyFile(from: String, to: String, promise: Promise) = background(promise, "FS_COPY") {
        val target = safe(to)
        target.parentFile?.mkdirs()
        safe(from).copyTo(target, overwrite = true)
        true
    }

    @ReactMethod fun zipDir(source: String, dest: String, promise: Promise) = background(promise, "ZIP") {
        val root = safe(source)
        val target = safe(dest)
        target.parentFile?.mkdirs()
        var count = 0
        ZipOutputStream(FileOutputStream(target)).use { zip ->
            fun add(file: File, name: String) {
                if (file.name == "node_modules" && file.isDirectory) return
                if (isSymlink(file)) return
                if (file.isDirectory) {
                    if (name.isNotEmpty()) { zip.putNextEntry(ZipEntry(name + "/")); zip.closeEntry() }
                    file.listFiles()?.sortedBy { it.name }?.forEach { child -> add(child, if (name.isEmpty()) child.name else name + "/" + child.name) }
                } else {
                    zip.putNextEntry(ZipEntry(name).apply { time = file.lastModified() })
                    FileInputStream(file).use { it.copyTo(zip, 65536) }
                    zip.closeEntry()
                    count++
                }
            }
            if (root.isDirectory) add(root, "") else add(root, root.name)
        }
        count
    }

    @ReactMethod fun unzip(archive: String, dest: String, promise: Promise) = background(promise, "UNZIP") {
        val root = safe(dest).apply { mkdirs() }
        var count = 0
        var written = 0L
        val buffer = ByteArray(65536)
        ZipInputStream(BufferedInputStream(FileInputStream(safe(archive)))).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val out = File(root, entry.name).canonicalFile
                if (out.path != root.path && !out.path.startsWith(root.path + File.separator)) throw SecurityException("Archive contains an unsafe path: " + entry.name)
                if (entry.isDirectory) out.mkdirs() else {
                    if (++count > MAX_ZIP_ENTRIES) throw IllegalArgumentException("The zip has more than $MAX_ZIP_ENTRIES files")
                    out.parentFile?.mkdirs()
                    FileOutputStream(out).use { output ->
                        while (true) {
                            val read = zip.read(buffer)
                            if (read < 0) break
                            written += read
                            if (written > MAX_ZIP_BYTES) throw IllegalArgumentException("The zip expands to more than 2 GB")
                            output.write(buffer, 0, read)
                        }
                    }
                }
                zip.closeEntry()
            }
        }
        count
    }

    @ReactMethod fun saveDocument(source: String, name: String, mime: String, promise: Promise) {
        val file = try { safe(source) } catch (error: Exception) { promise.reject("DOCUMENT", error.message, error); return }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name)
        launchForResult(intent, promise) { uri ->
            context.contentResolver.openOutputStream(uri, "wt")?.use { output -> FileInputStream(file).use { it.copyTo(output, 65536) } }
                ?: throw IllegalStateException("Could not write to that location")
            displayName(uri) ?: name
        }
    }

    @ReactMethod fun openDocument(mimes: ReadableArray, promise: Promise) {
        val types = (0 until mimes.size()).mapNotNull { mimes.getString(it) }.toTypedArray()
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(if (types.size == 1) types[0] else "*/*")
        if (types.size > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, types)
        launchForResult(intent, promise) { uri ->
            val name = (displayName(uri) ?: "import").replace('/', '_')
            val dir = File(cacheRoot, "imports").apply { mkdirs() }
            val target = File(dir, name)
            context.contentResolver.openInputStream(uri)?.use { input -> FileOutputStream(target).use { input.copyTo(it, 65536) } }
                ?: throw IllegalStateException("Could not read that file")
            Arguments.createMap().apply { putString("path", target.absolutePath); putString("name", name); putDouble("size", target.length().toDouble()) }
        }
    }

    private fun passwordKey(password: String, salt: ByteArray, rounds: Int = 600_000): SecretKeySpec {
        val spec = PBEKeySpec(password.toCharArray(), salt, rounds, 256)
        return SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded, "AES")
    }

    @ReactMethod fun encryptFile(source: String, dest: String, password: String, promise: Promise) = background(promise, "CRYPTO") {
        val random = SecureRandom()
        val salt = ByteArray(16).also { random.nextBytes(it) }
        val iv = ByteArray(12).also { random.nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, passwordKey(password, salt), GCMParameterSpec(128, iv)) }
        val sealed = cipher.doFinal(safe(source).readBytes())
        val target = safe(dest)
        target.parentFile?.mkdirs()
        FileOutputStream(target).use { it.write("FORGEBK2".toByteArray()); it.write(salt); it.write(iv); it.write(sealed) }
        true
    }

    @ReactMethod fun decryptFile(source: String, dest: String, password: String, promise: Promise) = background(promise, "CRYPTO") {
        val bytes = safe(source).readBytes()
        val magic = if (bytes.size >= 36) String(bytes, 0, 8) else ""
        val rounds = when (magic) { "FORGEBK2" -> 600_000; "FORGEBK1" -> 120_000; else -> throw IllegalArgumentException("This is not a Forge backup file") }
        val salt = bytes.copyOfRange(8, 24)
        val iv = bytes.copyOfRange(24, 36)
        val plain = try {
            Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, passwordKey(password, salt, rounds), GCMParameterSpec(128, iv)) }.doFinal(bytes, 36, bytes.size - 36)
        } catch (_: javax.crypto.AEADBadTagException) { throw IllegalArgumentException("Wrong password, or the file is damaged") }
        val target = safe(dest)
        target.parentFile?.mkdirs()
        target.writeBytes(plain)
        true
    }

    @ReactMethod fun notify(title: String, body: String, chatId: String?, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) { promise.resolve(false); return }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel("forge_done", "Finished tasks", NotificationManager.IMPORTANCE_DEFAULT))
            val open = Intent(context, MainActivity::class.java).setAction("com.forge.OPEN_CHAT").putExtra("chatId", chatId).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pending = PendingIntent.getActivity(context, (chatId ?: title).hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification = Notification.Builder(context, "forge_done").setSmallIcon(R.drawable.ic_stat_forge)
                .setContentTitle(title.take(80)).setContentText(body.take(200)).setStyle(Notification.BigTextStyle().bigText(body.take(600)))
                .setContentIntent(pending).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(Notification.Builder(context, "forge_done").setSmallIcon(R.drawable.ic_stat_forge).setContentTitle("Forge task finished").build())
                .build()
            manager.notify((chatId ?: title).hashCode(), notification)
            promise.resolve(true)
        } catch (error: Exception) { promise.resolve(false) }
    }

    @ReactMethod fun spawn(id: String, command: String, options: ReadableMap, promise: Promise) {
        val cwd = if (options.hasKey("cwd")) options.getString("cwd") else null
        val envMap = if (options.hasKey("env")) options.getMap("env")?.toHashMap() ?: hashMapOf() else hashMapOf<String, Any?>()
        background(promise, "SPAWN") {
            val process = linuxBuilder(command, cwd, envMap).redirectErrorStream(true).start()
            processes[id] = process
            Thread {
                try {
                    val buffer = ByteArray(8192)
                    val input = process.inputStream
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        emit("ForgeExec", Arguments.createMap().apply { putString("id", id); putString("data", String(buffer, 0, read)) })
                    }
                } catch (_: Exception) { }
                val code = try { process.waitFor() } catch (_: Exception) { -1 }
                processes.remove(id)
                emit("ForgeProcExit", Arguments.createMap().apply { putString("id", id); putInt("exitCode", code) })
            }.start()
            true
        }
    }

    override fun invalidate() {
        processes.values.forEach { it.destroyForcibly() }
        processes.clear()
        cancelled.values.forEach { it.set(true) }
        super.invalidate()
    }
}

private const val MAX_ZIP_ENTRIES = 50_000
private const val MAX_ZIP_BYTES = 2L * 1024 * 1024 * 1024

private class TarEntry(val name: String, val mode: Int, val size: Long, val type: Char, val link: String)

private class TarReader(private val input: InputStream) : AutoCloseable {
    private val header = ByteArray(512)
    private var pending = 0L

    private fun readFully(buffer: ByteArray, length: Int = buffer.size): Boolean {
        var offset = 0
        while (offset < length) {
            val read = input.read(buffer, offset, length - offset)
            if (read < 0) return offset == 0 && false
            offset += read
        }
        return true
    }

    private fun skipBytes(count: Long) {
        var left = count
        val scratch = ByteArray(65536)
        while (left > 0) {
            val read = input.read(scratch, 0, minOf(left, scratch.size.toLong()).toInt())
            if (read < 0) return
            left -= read
        }
    }

    private fun field(start: Int, length: Int): String {
        var end = start
        while (end < start + length && header[end] != 0.toByte()) end++
        return String(header, start, end - start, Charsets.UTF_8)
    }

    private fun octal(start: Int, length: Int): Long {
        if (header[start].toInt() and 0x80 != 0) {
            var value = 0L
            for (index in start + 1 until start + length) value = (value shl 8) or (header[index].toLong() and 0xFF)
            return value
        }
        val text = field(start, length).trim()
        return if (text.isEmpty()) 0 else text.toLong(8)
    }

    private fun readData(size: Long): ByteArray {
        val data = ByteArray(size.toInt())
        readFully(data)
        skipBytes(padding(size))
        return data
    }

    private fun padding(size: Long) = (512 - size % 512) % 512

    fun next(): TarEntry? {
        if (pending > 0) { skipBytes(pending); pending = 0 }
        var longName: String? = null
        var longLink: String? = null
        while (true) {
            if (!readFully(header)) return null
            if (header.all { it == 0.toByte() }) return null
            val type = header[156].toInt().toChar()
            val size = octal(124, 12)
            when (type) {
                'L' -> { longName = String(readData(size)).trimEnd('\u0000'); continue }
                'K' -> { longLink = String(readData(size)).trimEnd('\u0000'); continue }
                'x', 'g' -> {
                    val pax = String(readData(size), Charsets.UTF_8)
                    pax.split('\n').forEach { line ->
                        val record = line.substringAfter(' ', "")
                        if (record.startsWith("path=")) longName = record.removePrefix("path=")
                        if (record.startsWith("linkpath=")) longLink = record.removePrefix("linkpath=")
                    }
                    continue
                }
            }
            val prefix = if (field(257, 6).startsWith("ustar")) field(345, 155) else ""
            val baseName = field(0, 100)
            val name = longName ?: if (prefix.isNotEmpty()) "$prefix/$baseName" else baseName
            val link = longLink ?: field(157, 100)
            pending = if (type == '0' || type == '\u0000' || type == '7') 0 else size + padding(size)
            return TarEntry(name, octal(100, 8).toInt(), size, type, link)
        }
    }

    fun copyTo(entry: TarEntry, output: FileOutputStream) {
        var left = entry.size
        val buffer = ByteArray(256 * 1024)
        while (left > 0) {
            val read = input.read(buffer, 0, minOf(left, buffer.size.toLong()).toInt())
            if (read < 0) throw IllegalStateException("Archive ended early")
            output.write(buffer, 0, read)
            left -= read
        }
        skipBytes(padding(entry.size))
    }

    fun skip(entry: TarEntry) {
        if (entry.type == '0' || entry.type == '\u0000' || entry.type == '7') skipBytes(entry.size + padding(entry.size))
        else if (pending > 0) { skipBytes(pending); pending = 0 }
    }

    override fun close() = input.close()
}
