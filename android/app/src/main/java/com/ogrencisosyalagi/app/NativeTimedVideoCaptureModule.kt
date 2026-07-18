package com.ogrencisosyalagi.app

import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class NativeTimedVideoCaptureModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val FILE_PROVIDER_SUFFIX = ".nativeimagecropper.fileprovider"
    private const val REQUEST_CODE_CAPTURE = 41931
    private const val OUTPUT_FILE_WAIT_STEP_MS = 140L
    private const val OUTPUT_FILE_WAIT_TIMEOUT_MS = 25000L
    private const val RECENT_CAPTURE_LOOKBACK_MS = 20000L
    private const val RECENT_CAPTURE_QUERY_LIMIT = 6
    private const val VIDEO_DURATION_READ_RETRY_DELAY_MS = 160L
    private const val VIDEO_DURATION_READ_RETRY_COUNT = 12
    private const val VIDEO_DURATION_GRACE_MS = 5000L
    private const val VIDEO_UPLOAD_GRACE_SECONDS = 5L
    private const val TARGET_1080P_VIDEO_BITRATE_BPS = 8_500_000L
    private const val TARGET_1080P_AUDIO_BITRATE_BPS = 192_000L
  }

  private var pendingOutputFile: File? = null
  private var pendingOutputUri: Uri? = null
  private var pendingPromise: Promise? = null
  private var lastRequestedDurationSeconds: Int = 180
  private var lastRequestedMaxFileSizeBytes: Long = 0L
  private var lastCaptureStartedAtMs: Long = 0L
  private val backgroundExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_CODE_CAPTURE) return

      val promise = pendingPromise
      val outputFile = pendingOutputFile
      val outputUri = pendingOutputUri
      val captureStartedAtMs = lastCaptureStartedAtMs
      val maxFileSizeBytes = lastRequestedMaxFileSizeBytes
      pendingPromise = null
      pendingOutputFile = null
      pendingOutputUri = null
      lastCaptureStartedAtMs = 0L
      lastRequestedMaxFileSizeBytes = 0L

      if (promise == null) {
        revokeOutputUriPermission(outputUri)
        return
      }

      val requestedDurationSeconds = lastRequestedDurationSeconds
      backgroundExecutor.execute {
        val maxDurationMs = maxOf(requestedDurationSeconds, 1) * 1000L + VIDEO_DURATION_GRACE_MS
        val completedFile = resolveCompletedCapture(
          data,
          outputFile,
          maxDurationMs,
          maxFileSizeBytes,
          captureStartedAtMs,
        )
        if (resultCode == Activity.RESULT_OK && completedFile == null) {
          deleteQuietly(outputFile)
        }
        mainHandler.post {
          resolveCapturePromise(resultCode, completedFile, promise)
          revokeOutputUriPermission(outputUri)
        }
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "NativeTimedVideoCapture"

  override fun invalidate() {
    backgroundExecutor.shutdownNow()
    super.invalidate()
  }

  @ReactMethod
  fun capture(maxDurationSeconds: Int, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_CAPTURE_IN_PROGRESS", "Baska bir video kaydi zaten acik.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Etkin aktivite bulunamadi.")
      return
    }

    val authority = reactApplicationContext.packageName + FILE_PROVIDER_SUFFIX
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    val outputFile = File(outputDirectory, "native-video-${System.currentTimeMillis()}.mp4")
    outputFile.parentFile?.mkdirs()
    val outputUri = FileProvider.getUriForFile(reactApplicationContext, authority, outputFile)
    val safeDurationLimit = maxDurationSeconds.coerceAtLeast(1)
    val maxFileSizeBytes = resolveMaxFileSizeBytes(safeDurationLimit)
    val captureIntent = Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply {
      putExtra(MediaStore.EXTRA_DURATION_LIMIT, safeDurationLimit)
      putExtra("android.intent.extra.durationLimit", safeDurationLimit)
      putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1)
      putExtra("android.intent.extra.videoQuality", 1)
      putExtra(MediaStore.EXTRA_SIZE_LIMIT, maxFileSizeBytes)
      putExtra("android.intent.extra.sizeLimit", maxFileSizeBytes)
      putExtra(MediaStore.EXTRA_OUTPUT, outputUri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    }

    val activities = reactApplicationContext.packageManager.queryIntentActivities(
      captureIntent,
      PackageManager.MATCH_DEFAULT_ONLY,
    )

    if (activities.isEmpty()) {
      promise.reject("E_CAPTURE_UNAVAILABLE", "Bu cihazda sistem video kaydi acilamadi.")
      return
    }

    val permissionFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    activities.forEach { resolveInfo ->
      reactApplicationContext.grantUriPermission(resolveInfo.activityInfo.packageName, outputUri, permissionFlags)
    }

    pendingPromise = promise
    pendingOutputFile = outputFile
    pendingOutputUri = outputUri
    lastRequestedDurationSeconds = safeDurationLimit
    lastRequestedMaxFileSizeBytes = maxFileSizeBytes
    lastCaptureStartedAtMs = System.currentTimeMillis()

    try {
      activity.startActivityForResult(captureIntent, REQUEST_CODE_CAPTURE)
    } catch (error: Exception) {
      pendingPromise = null
      pendingOutputFile = null
      pendingOutputUri = null
      lastCaptureStartedAtMs = 0L
      lastRequestedMaxFileSizeBytes = 0L
      revokeOutputUriPermission(outputUri)
      promise.reject("E_CAPTURE_LAUNCH_FAILED", error.message, error)
    }
  }

  private fun revokeOutputUriPermission(outputUri: Uri?) {
    if (outputUri == null) return
    val permissionFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    try {
      reactApplicationContext.revokeUriPermission(outputUri, permissionFlags)
    } catch (_: Exception) {
    }
  }

  private fun resolveCapturePromise(resultCode: Int, completedFile: File?, promise: Promise) {
    when (resultCode) {
      Activity.RESULT_OK -> {
        if (completedFile != null) {
          promise.resolve("file://${completedFile.absolutePath}")
        } else {
          promise.reject("E_CAPTURE_FAILED", "Video 3 dakika sinirini asti, 1080p boyut tavanini gecti veya dosya olusturulamadi.")
        }
      }

      Activity.RESULT_CANCELED -> {
        if (completedFile != null) {
          promise.resolve("file://${completedFile.absolutePath}")
        } else {
          promise.reject("E_PICKER_CANCELLED", "User cancelled video capture")
        }
      }

      else -> {
        if (completedFile != null) {
          promise.resolve("file://${completedFile.absolutePath}")
        } else {
          promise.reject("E_CAPTURE_FAILED", "Video kaydi tamamlanamadi.")
        }
      }
    }
  }

  private fun resolveCapturedFile(data: Intent?, outputFile: File?, captureStartedAtMs: Long): File? {
    val completedOutputFile = waitForCompletedOutputFile(outputFile)
    if (completedOutputFile != null) {
      return completedOutputFile
    }

    val sourceUri = data?.data
    if (sourceUri != null) {
      if (outputFile != null && copyUriToFile(sourceUri, outputFile)) {
        return waitForCompletedOutputFile(outputFile) ?: outputFile.takeIf { it.exists() && it.length() > 0L }
      }

      val copiedFile = copyUriToFreshTempFile(sourceUri)
      return copiedFile?.let { waitForCompletedOutputFile(it) ?: it.takeIf { file -> file.exists() && file.length() > 0L } }
    }

    val recentCaptureFile = findRecentCapturedVideoFile(captureStartedAtMs)
    if (recentCaptureFile != null) {
      return recentCaptureFile
    }

    return outputFile?.takeIf { it.exists() && it.length() > 0L }
  }

  private fun resolveCompletedCapture(
    data: Intent?,
    outputFile: File?,
    maxDurationMs: Long,
    maxFileSizeBytes: Long,
    captureStartedAtMs: Long,
  ): File? {
    val resolvedFile = resolveCapturedFile(data, outputFile, captureStartedAtMs) ?: return null
    if (!resolvedFile.exists() || resolvedFile.length() <= 0L) {
      return null
    }
    if (!isWithinDurationLimit(resolvedFile, maxDurationMs)) {
      deleteQuietly(resolvedFile)
      return null
    }
    if (!isWithinFileSizeLimit(resolvedFile, maxFileSizeBytes)) {
      deleteQuietly(resolvedFile)
      return null
    }
    return resolvedFile
  }

  private fun resolveMaxFileSizeBytes(maxDurationSeconds: Int): Long {
    val durationWithGraceSeconds = maxOf(maxDurationSeconds, 1).toLong() + VIDEO_UPLOAD_GRACE_SECONDS
    return ((TARGET_1080P_VIDEO_BITRATE_BPS + TARGET_1080P_AUDIO_BITRATE_BPS) * durationWithGraceSeconds + 7L) / 8L
  }

  private fun copyUriToFreshTempFile(uri: Uri): File? {
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    val outputFile = File(outputDirectory, "native-video-copy-${System.currentTimeMillis()}.mp4")
    outputFile.parentFile?.mkdirs()
    return if (copyUriToFile(uri, outputFile)) outputFile else null
  }

  private fun findRecentCapturedVideoFile(captureStartedAtMs: Long): File? {
    if (captureStartedAtMs <= 0L) {
      return null
    }

    val querySinceMs = maxOf(captureStartedAtMs - RECENT_CAPTURE_LOOKBACK_MS, 0L)
    val querySinceSeconds = querySinceMs / 1000L
    val projection = arrayOf(
      MediaStore.Video.Media._ID,
      MediaStore.Video.Media.DATE_ADDED,
      MediaStore.Video.Media.DATE_TAKEN,
    )
    val selection =
      "${MediaStore.Video.Media.DATE_ADDED} >= ? OR ${MediaStore.Video.Media.DATE_TAKEN} >= ?"
    val selectionArgs = arrayOf(querySinceSeconds.toString(), querySinceMs.toString())

    return try {
      reactApplicationContext.contentResolver.query(
        MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        selectionArgs,
        "${MediaStore.Video.Media.DATE_ADDED} DESC",
      )?.use { cursor ->
        val idIndex = cursor.getColumnIndex(MediaStore.Video.Media._ID)
        var checkedCount = 0
        while (idIndex >= 0 && cursor.moveToNext() && checkedCount < RECENT_CAPTURE_QUERY_LIMIT) {
          val videoId = cursor.getLong(idIndex)
          val contentUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, videoId)
          val copiedFile = copyUriToFreshTempFile(contentUri)
          if (copiedFile != null) {
            val readyFile = waitForCompletedOutputFile(copiedFile)
            if (readyFile != null) {
              return readyFile
            }
          }
          checkedCount += 1
        }
        null
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun copyUriToFile(sourceUri: Uri, outputFile: File): Boolean {
    return try {
      reactApplicationContext.contentResolver.openInputStream(sourceUri)?.use { inputStream ->
        FileOutputStream(outputFile).use { outputStream ->
          inputStream.copyTo(outputStream)
        }
      }
      outputFile.exists() && outputFile.length() > 0L
    } catch (_: Exception) {
      false
    }
  }

  private fun isWithinDurationLimit(file: File, maxDurationMs: Long): Boolean {
    val durationMs = readDurationMs(file) ?: return true
    return durationMs in 1..maxDurationMs
  }

  private fun isWithinFileSizeLimit(file: File, maxFileSizeBytes: Long): Boolean {
    if (maxFileSizeBytes <= 0L) return true
    return file.length() in 1..maxFileSizeBytes
  }

  private fun readDurationMs(file: File): Long? {
    repeat(VIDEO_DURATION_READ_RETRY_COUNT) { attempt ->
      val durationMs = readDurationMsOnce(file)
      if (durationMs != null && durationMs > 0L) {
        return durationMs
      }
      if (attempt < VIDEO_DURATION_READ_RETRY_COUNT - 1) {
        SystemClock.sleep(VIDEO_DURATION_READ_RETRY_DELAY_MS)
      }
    }
    return null
  }

  private fun readDurationMsOnce(file: File): Long? {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.absolutePath)
      val durationValue = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
      durationValue?.toLongOrNull()
    } catch (_: Exception) {
      null
    } finally {
      try {
        retriever.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun waitForCompletedOutputFile(file: File?): File? {
    if (file == null) return null

    val deadline = SystemClock.elapsedRealtime() + OUTPUT_FILE_WAIT_TIMEOUT_MS
    while (SystemClock.elapsedRealtime() < deadline) {
      if (file.exists() && file.length() > 0L) {
        return file
      }
      SystemClock.sleep(OUTPUT_FILE_WAIT_STEP_MS)
    }

    return file.takeIf { it.exists() && it.length() > 0L }
  }

  private fun deleteQuietly(file: File?) {
    try {
      file?.delete()
    } catch (_: Exception) {
    }
  }
}
