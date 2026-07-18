package com.ogrencisosyalagi.app

import android.media.MediaCodecInfo
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.effect.Presentation
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

class NativeVideoNormalizerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val MIN_VIDEO_BITRATE_BPS = 1_500_000
    private const val MIN_AUDIO_BITRATE_BPS = 96_000
    private const val MAX_VIDEO_DURATION_FALLBACK_MS = 185_000L
    private const val SOURCE_DURATION_GRACE_MS = 5_000L
    private const val OUTPUT_FILE_PREFIX = "native-video-normalized"
    private const val SOURCE_FILE_PREFIX = "native-video-source"
  }

  private data class PendingState(
    val outputFile: File?,
    val promise: Promise?,
    val sourceTempFile: File?,
  )

  private data class PreparedSource(
    val file: File,
    val sourceTempFile: File?,
  )

  private data class NormalizationRequest(
    val audioBitrateBps: Int,
    val clipEndMs: Long?,
    val maxBytes: Long,
    val maxDurationMs: Long,
    val outputFile: File,
    val outputHeight: Int,
    val outputWidth: Int,
    val sourceFile: File,
    val sourceTempFile: File?,
    val videoBitrateBps: Int,
  )

  private data class VideoMetadata(
    val displayHeight: Int,
    val displayWidth: Int,
    val durationMs: Long,
  )

  private val mainHandler = Handler(Looper.getMainLooper())
  private val stateLock = Any()
  private var pendingOutputFile: File? = null
  private var pendingPromise: Promise? = null
  private var pendingSourceTempFile: File? = null
  private var activeTransformer: Transformer? = null

  override fun getName(): String = "NativeVideoNormalizer"

  @ReactMethod
  fun normalize(
    sourceUri: String,
    baseName: String,
    maxDurationSeconds: Int,
    targetLongEdgePx: Int,
    targetShortEdgePx: Int,
    videoBitrateBps: Int,
    audioBitrateBps: Int,
    maxBytes: Double,
    promise: Promise,
  ) {
    synchronized(stateLock) {
      if (pendingPromise != null) {
        promise.reject("E_NORMALIZE_IN_PROGRESS", "Baska bir video hazirlama islemi zaten calisiyor.")
        return
      }
      pendingPromise = promise
    }

    val request = try {
      buildNormalizationRequest(
        sourceUri = sourceUri,
        baseName = baseName,
        maxBytes = maxBytes.toLong(),
        maxDurationSeconds = maxDurationSeconds,
        targetLongEdgePx = targetLongEdgePx,
        targetShortEdgePx = targetShortEdgePx,
        videoBitrateBps = videoBitrateBps,
        audioBitrateBps = audioBitrateBps,
      )
    } catch (error: IllegalArgumentException) {
      failPending("E_NORMALIZE_INVALID_SOURCE", error.message ?: "Video hazirlanamadi.")
      return
    } catch (error: Exception) {
      failPending("E_NORMALIZE_PREPARE_FAILED", error.message ?: "Video hazirlanamadi.", error)
      return
    }

    synchronized(stateLock) {
      pendingOutputFile = request.outputFile
      pendingSourceTempFile = request.sourceTempFile
    }

    mainHandler.post {
      try {
        startNormalization(request)
      } catch (error: Exception) {
        failPending(
          "E_NORMALIZE_START_FAILED",
          error.message ?: buildVideoNormalizationFailureMessage(),
          error,
        )
      }
    }
  }

  private fun buildNormalizationRequest(
    sourceUri: String,
    baseName: String,
    maxBytes: Long,
    maxDurationSeconds: Int,
    targetLongEdgePx: Int,
    targetShortEdgePx: Int,
    videoBitrateBps: Int,
    audioBitrateBps: Int,
  ): NormalizationRequest {
    require(targetLongEdgePx > 0 && targetShortEdgePx > 0) {
      "Gecersiz 1080p hedef boyutu."
    }
    val preparedSource = prepareSourceFile(sourceUri, baseName)
    try {
      val sourceMetadata = readVideoMetadata(preparedSource.file)
        ?: throw IllegalArgumentException("Video meta verisi okunamadi.")
      val maxDurationMs = max(maxDurationSeconds, 1) * 1000L
      val sourceDurationLimitMs = maxDurationMs + SOURCE_DURATION_GRACE_MS
      if (sourceMetadata.durationMs > sourceDurationLimitMs) {
        throw IllegalArgumentException(buildVideoDurationLimitMessage())
      }
      val clipEndMs = if (sourceMetadata.durationMs > maxDurationMs) maxDurationMs else null
      val isPortrait = sourceMetadata.displayHeight > sourceMetadata.displayWidth
      val outputWidth = if (isPortrait) targetShortEdgePx else targetLongEdgePx
      val outputHeight = if (isPortrait) targetLongEdgePx else targetShortEdgePx
      val safeAudioBitrateBps = audioBitrateBps.coerceAtLeast(MIN_AUDIO_BITRATE_BPS)
      val safeVideoBitrateBps = resolveRequestedVideoBitrate(
        maxBytes = maxBytes,
        maxDurationMs = maxDurationMs,
        requestedAudioBitrateBps = safeAudioBitrateBps,
        requestedVideoBitrateBps = videoBitrateBps.coerceAtLeast(MIN_VIDEO_BITRATE_BPS),
      )

      return NormalizationRequest(
        audioBitrateBps = safeAudioBitrateBps,
        clipEndMs = clipEndMs,
        maxBytes = maxBytes,
        maxDurationMs = maxDurationMs,
        outputFile = createOutputFile(baseName),
        outputHeight = outputHeight,
        outputWidth = outputWidth,
        sourceFile = preparedSource.file,
        sourceTempFile = preparedSource.sourceTempFile,
        videoBitrateBps = safeVideoBitrateBps,
      )
    } catch (error: Exception) {
      deleteQuietly(preparedSource.sourceTempFile)
      throw error
    }
  }

  private fun startNormalization(request: NormalizationRequest) {
    val videoEncoderSettings = VideoEncoderSettings.Builder()
      .setBitrate(request.videoBitrateBps)
      .setBitrateMode(MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR)
      .build()
    val audioEncoderSettings = AudioEncoderSettings.Builder()
      .setBitrate(request.audioBitrateBps)
      .build()
    val presentationEffect = Presentation.createForWidthAndHeight(
      request.outputWidth,
      request.outputHeight,
      Presentation.LAYOUT_SCALE_TO_FIT,
    )
    val clipEndMs = request.clipEndMs
    val mediaItem = MediaItem.Builder()
      .setUri(Uri.fromFile(request.sourceFile))
      .apply {
        if (clipEndMs != null) {
          setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder()
              .setEndPositionMs(clipEndMs)
              .build(),
          )
        }
      }
      .build()
    val editedMediaItem = EditedMediaItem.Builder(
      mediaItem,
    ).setEffects(
      Effects(
        emptyList<AudioProcessor>(),
        listOf(presentationEffect),
      ),
    ).build()
    val transformer = Transformer.Builder(reactApplicationContext)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setEncoderFactory(
        DefaultEncoderFactory.Builder(reactApplicationContext)
          .setEnableFallback(true)
          .setRequestedAudioEncoderSettings(audioEncoderSettings)
          .setRequestedVideoEncoderSettings(videoEncoderSettings)
          .build(),
      )
      .addListener(
        object : Transformer.Listener {
          override fun onCompleted(composition: Composition, exportResult: ExportResult) {
            completePending(request)
          }

          override fun onError(
            composition: Composition,
            exportResult: ExportResult,
            exportException: ExportException,
          ) {
            failPending(
              "E_NORMALIZE_FAILED",
              buildVideoNormalizationFailureMessage(),
              exportException,
            )
          }
        },
      )
      .build()

    synchronized(stateLock) {
      activeTransformer = transformer
    }
    transformer.start(editedMediaItem, request.outputFile.absolutePath)
  }

  private fun completePending(request: NormalizationRequest) {
    val outputFile = synchronized(stateLock) { pendingOutputFile }
    if (outputFile == null || !outputFile.exists() || outputFile.length() <= 0L) {
      failPending("E_NORMALIZE_OUTPUT_MISSING", "1080p video ciktisi olusturulamadi.")
      return
    }

    val outputMetadata = readVideoMetadata(outputFile)
    if (outputMetadata == null) {
      failPending("E_NORMALIZE_OUTPUT_INVALID", "1080p video meta verisi okunamadi.")
      return
    }
    if (outputMetadata.durationMs > request.maxDurationMs) {
      failPending("E_NORMALIZE_OUTPUT_TOO_LONG", buildVideoDurationLimitMessage())
      return
    }
    val fileSizeBytes = outputFile.length()
    if (request.maxBytes > 0L && fileSizeBytes > request.maxBytes) {
      failPending(
        "E_NORMALIZE_OUTPUT_TOO_LARGE",
        buildVideoSizeLimitMessage(request.maxBytes),
      )
      return
    }

    val state = clearPendingState()
    deleteQuietly(state.sourceTempFile)
    val result = Arguments.createMap().apply {
      putDouble("durationMs", outputMetadata.durationMs.toDouble())
      putInt("height", outputMetadata.displayHeight)
      putString("mimeType", "video/mp4")
      putDouble("sizeBytes", fileSizeBytes.toDouble())
      putString("uri", "file://${outputFile.absolutePath}")
      putInt("width", outputMetadata.displayWidth)
    }
    state.promise?.resolve(result)
  }

  private fun clearPendingState(): PendingState {
    synchronized(stateLock) {
      val state = PendingState(
        outputFile = pendingOutputFile,
        promise = pendingPromise,
        sourceTempFile = pendingSourceTempFile,
      )
      pendingOutputFile = null
      pendingPromise = null
      pendingSourceTempFile = null
      activeTransformer = null
      return state
    }
  }

  private fun failPending(code: String, message: String, error: Throwable? = null) {
    val state = clearPendingState()
    deleteQuietly(state.outputFile)
    deleteQuietly(state.sourceTempFile)
    val promise = state.promise ?: return
    if (error != null) {
      promise.reject(code, message, error)
    } else {
      promise.reject(code, message)
    }
  }

  private fun prepareSourceFile(sourceUri: String, baseName: String): PreparedSource {
    val normalizedUri = sourceUri.trim()
    require(normalizedUri.isNotEmpty()) { "Video secilmedi." }
    if (normalizedUri.startsWith("content://", ignoreCase = true)) {
      val tempFile = copyContentUriToFreshTempFile(
        Uri.parse(normalizedUri),
        resolveFileExtension(normalizedUri, baseName, "mp4"),
      ) ?: throw IllegalArgumentException("Video dosyasi okunamadi.")
      return PreparedSource(tempFile, tempFile)
    }

    val sourceFile = if (normalizedUri.startsWith("file://", ignoreCase = true)) {
      val sourcePath = Uri.parse(normalizedUri).path ?: throw IllegalArgumentException("Video dosyasi bulunamadi.")
      File(sourcePath)
    } else {
      File(normalizedUri)
    }
    require(sourceFile.exists() && sourceFile.isFile) { "Video dosyasi bulunamadi." }
    return PreparedSource(sourceFile, null)
  }

  private fun createOutputFile(baseName: String): File {
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    outputDirectory.mkdirs()
    val safeBaseName = sanitizeBaseName(baseName)
    return File(
      outputDirectory,
      "$OUTPUT_FILE_PREFIX-$safeBaseName-${System.currentTimeMillis()}.mp4",
    )
  }

  private fun copyContentUriToFreshTempFile(uri: Uri, extension: String): File? {
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    outputDirectory.mkdirs()
    val outputFile = File(
      outputDirectory,
      "$SOURCE_FILE_PREFIX-${System.currentTimeMillis()}.$extension",
    )
    return if (copyUriToFile(uri, outputFile)) outputFile else null
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

  private fun readVideoMetadata(file: File): VideoMetadata? {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(file.absolutePath)
      val rawWidth = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull() ?: return null
      val rawHeight = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        ?.toIntOrNull() ?: return null
      val rotationDegrees = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        ?.toIntOrNull() ?: 0
      val durationMs = retriever
        .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        ?.toLongOrNull() ?: MAX_VIDEO_DURATION_FALLBACK_MS
      val isRotated = rotationDegrees == 90 || rotationDegrees == 270
      val displayWidth = if (isRotated) rawHeight else rawWidth
      val displayHeight = if (isRotated) rawWidth else rawHeight
      if (displayWidth <= 0 || displayHeight <= 0 || durationMs <= 0L) {
        return null
      }
      VideoMetadata(
        displayHeight = displayHeight,
        displayWidth = displayWidth,
        durationMs = durationMs,
      )
    } catch (_: Exception) {
      null
    } finally {
      try {
        retriever.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun resolveRequestedVideoBitrate(
    maxBytes: Long,
    maxDurationMs: Long,
    requestedAudioBitrateBps: Int,
    requestedVideoBitrateBps: Int,
  ): Int {
    if (maxBytes <= 0L || maxDurationMs <= 0L) {
      return requestedVideoBitrateBps
    }
    val durationSeconds = maxDurationMs / 1000.0
    val maxTotalBitrateBps = ((maxBytes * 8.0) / durationSeconds).toInt()
    val maxVideoBitrateBps =
      (maxTotalBitrateBps - requestedAudioBitrateBps).coerceAtLeast(MIN_VIDEO_BITRATE_BPS)
    return min(requestedVideoBitrateBps, maxVideoBitrateBps)
  }

  private fun sanitizeBaseName(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return "upload"
    val withoutExtension = trimmed.replace(Regex("\\.[^.]+$"), "")
    val compact = withoutExtension
      .lowercase()
      .replace(Regex("[^a-z0-9_-]+"), "-")
      .replace(Regex("-{2,}"), "-")
      .trim('-')
    return compact.ifEmpty { "upload" }
  }

  private fun resolveFileExtension(primary: String, secondary: String, fallback: String): String {
    return extractFileExtension(primary)
      ?: extractFileExtension(secondary)
      ?: fallback
  }

  private fun extractFileExtension(value: String): String? {
    val match = Regex("\\.([a-zA-Z0-9]{2,5})(?:$|[?#])").find(value.trim())
    return match?.groupValues?.getOrNull(1)?.lowercase()?.takeIf { it.isNotBlank() }
  }

  private fun buildVideoDurationLimitMessage(): String {
    return "Video suresi cok uzun. En fazla 3 dakikalik video yukleyebilirsin."
  }

  private fun buildVideoNormalizationFailureMessage(): String {
    return "Video 1080p olarak hazirlanamadi. Lutfen daha kisa veya farkli bir video secip tekrar dene."
  }

  private fun buildVideoSizeLimitMessage(maxBytes: Long): String {
    val maxMb = max(1.0, kotlin.math.round(maxBytes / 1_000_000.0)).toInt()
    return "Video boyutu cok buyuk. 1080p olarak hazirlandiginda en fazla $maxMb MB video yukleyebilirsin."
  }

  private fun deleteQuietly(file: File?) {
    try {
      file?.delete()
    } catch (_: Exception) {
    }
  }
}
