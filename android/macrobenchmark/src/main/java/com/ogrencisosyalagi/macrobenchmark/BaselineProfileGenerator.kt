package com.ogrencisosyalagi.macrobenchmark

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
  @get:Rule val baselineProfileRule = BaselineProfileRule()

  @Test
  fun generate() {
    baselineProfileRule.collect(
      packageName = "com.ogrencisosyalagi.app",
      maxIterations = 10,
      stableIterations = 3,
      includeInStartupProfile = true,
    ) {
      pressHome()
      startActivityAndWait()
      device.waitForIdle()

      // Include the interaction paths that dominate real sessions. Text
      // lookups are optional so profile generation remains valid for both an
      // authenticated seed and the public/auth shell.
      device.findObject(By.text("Ana Sayfa"))?.click()
      device.waitForIdle()
      repeat(3) {
        device.swipe(
          device.displayWidth / 2,
          device.displayHeight * 3 / 4,
          device.displayWidth / 2,
          device.displayHeight / 4,
          12,
        )
      }
      device.findObject(By.text("Ara"))?.click()
      device.waitForIdle()
      device.findObject(By.text("Profil"))?.click()
      device.waitForIdle()
    }
  }
}
