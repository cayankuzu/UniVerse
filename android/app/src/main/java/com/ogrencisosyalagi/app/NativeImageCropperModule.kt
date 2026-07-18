package com.ogrencisosyalagi.app

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import androidx.core.os.bundleOf
import com.canhub.cropper.CropImage
import com.canhub.cropper.CropImageOptions
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class NativeImageCropperModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val REQUEST_CODE_CROP = 41921
    private const val FILE_PROVIDER_SUFFIX = ".nativeimagecropper.fileprovider"
  }

  private var pendingPromise: Promise? = null
  private var pendingOutputFile: File? = null

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_CODE_CROP) return

      val promise = pendingPromise
      val outputFile = pendingOutputFile
      pendingPromise = null
      pendingOutputFile = null

      if (promise == null) return

      val completedFile = resolveCompletedCrop(data, outputFile)

      when (resultCode) {
        Activity.RESULT_OK -> {
          if (completedFile != null) {
            promise.resolve("file://${completedFile.absolutePath}")
          } else {
            promise.reject("E_CROP_FAILED", "Kirpilan dosya olusturulamadi.")
          }
        }

        Activity.RESULT_CANCELED -> {
          if (completedFile != null) {
            promise.resolve("file://${completedFile.absolutePath}")
          } else {
            promise.reject("E_PICKER_CANCELLED", "User cancelled image selection")
          }
        }

        else -> {
          if (completedFile != null) {
            promise.resolve("file://${completedFile.absolutePath}")
          } else {
            promise.reject("E_CROP_FAILED", "Kirpma tamamlanamadi.")
          }
        }
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "NativeImageCropper"

  @ReactMethod
  fun crop(uri: String, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_CROP_IN_PROGRESS", "Baska bir kirpma islemi zaten acik.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Etkin aktivite bulunamadi.")
      return
    }

    val authority = reactApplicationContext.packageName + FILE_PROVIDER_SUFFIX
    val sourceUri = resolveSourceUri(uri, authority)
    if (sourceUri == null || !canReadUri(sourceUri)) {
      promise.reject("E_CROPPER_IMAGE_NOT_FOUND", "Kirpilacak fotograf bulunamadi.")
      return
    }

    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    val outputFile = File(outputDirectory, "native-crop-${System.currentTimeMillis()}.jpg")
    outputFile.parentFile?.mkdirs()
    val outputUri = FileProvider.getUriForFile(reactApplicationContext, authority, outputFile)

    val cropIntent = Intent(
      reactApplicationContext,
      expo.modules.imagepicker.ExpoCropImageActivity::class.java,
    ).apply {
      putExtra(
        CropImage.CROP_IMAGE_EXTRA_BUNDLE,
        bundleOf(
          CropImage.CROP_IMAGE_EXTRA_SOURCE to sourceUri,
          CropImage.CROP_IMAGE_EXTRA_OPTIONS to CropImageOptions().apply {
            customOutputUri = outputUri
            initialCropWindowPaddingRatio = 0f
            outputCompressFormat = Bitmap.CompressFormat.JPEG
            outputCompressQuality = 92
          },
        ),
      )
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    }

    pendingPromise = promise
    pendingOutputFile = outputFile

    try {
      activity.startActivityForResult(cropIntent, REQUEST_CODE_CROP)
    } catch (error: Exception) {
      pendingPromise = null
      pendingOutputFile = null
      promise.reject("E_CROPPER_LAUNCH_FAILED", error.message, error)
    }
  }

  private fun resolveSourceUri(uri: String, authority: String): Uri? {
    val trimmed = uri.trim()
    if (trimmed.isEmpty()) return null

    if (trimmed.startsWith("content://", ignoreCase = true)) {
      return Uri.parse(trimmed)
    }

    val sourceFile = if (trimmed.startsWith("file://", ignoreCase = true)) {
      val parsedPath = Uri.parse(trimmed).path ?: return null
      File(parsedPath)
    } else {
      File(trimmed)
    }

    if (!sourceFile.exists()) return null
    return try {
      FileProvider.getUriForFile(reactApplicationContext, authority, sourceFile)
    } catch (_: IllegalArgumentException) {
      val cachedCopy = copyFileToFreshTempFile(sourceFile) ?: return null
      FileProvider.getUriForFile(reactApplicationContext, authority, cachedCopy)
    }
  }

  private fun canReadUri(uri: Uri): Boolean {
    return try {
      reactApplicationContext.contentResolver.openInputStream(uri)?.use {
        true
      } ?: false
    } catch (_: Exception) {
      false
    }
  }

  private fun resolveCompletedCrop(data: Intent?, outputFile: File?): File? {
    if (outputFile != null && outputFile.exists() && outputFile.length() > 0L) {
      return outputFile
    }

    val sourceUri = extractCroppedResultUri(data) ?: data?.data
      ?: return outputFile?.takeIf { it.exists() && it.length() > 0L }
    if (outputFile == null) {
      return copyUriToFreshTempFile(sourceUri)
    }

    return if (copyUriToFile(sourceUri, outputFile)) outputFile else outputFile.takeIf { it.exists() && it.length() > 0L }
  }

  private fun extractCroppedResultUri(data: Intent?): Uri? {
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      data?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT, CropImage.ActivityResult::class.java)
    } else {
      @Suppress("DEPRECATION")
      data?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT)
    }
    return result?.uriContent
  }

  private fun copyUriToFreshTempFile(uri: Uri): File? {
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    val outputFile = File(outputDirectory, "native-crop-copy-${System.currentTimeMillis()}.jpg")
    outputFile.parentFile?.mkdirs()
    return if (copyUriToFile(uri, outputFile)) outputFile else null
  }

  private fun copyFileToFreshTempFile(sourceFile: File): File? {
    val extension = sourceFile.extension.takeIf { it.isNotBlank() }?.let { ".$it" } ?: ".jpg"
    val outputDirectory = reactApplicationContext.externalCacheDir ?: reactApplicationContext.cacheDir
    val outputFile = File(outputDirectory, "native-crop-source-${System.currentTimeMillis()}$extension")
    outputFile.parentFile?.mkdirs()
    return if (copyFileToFile(sourceFile, outputFile)) outputFile else null
  }

  private fun copyFileToFile(sourceFile: File, outputFile: File): Boolean {
    return try {
      sourceFile.inputStream().use { inputStream ->
        FileOutputStream(outputFile).use { outputStream ->
          inputStream.copyTo(outputStream)
        }
      }
      outputFile.exists() && outputFile.length() > 0L
    } catch (_: Exception) {
      false
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
}
