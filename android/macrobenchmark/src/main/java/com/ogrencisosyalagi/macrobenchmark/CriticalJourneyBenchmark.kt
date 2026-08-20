package com.ogrencisosyalagi.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CriticalJourneyBenchmark {
  @get:Rule val benchmarkRule = MacrobenchmarkRule()

  @Test
  fun homeScrollAndPrimaryNavigation() {
    benchmarkRule.measureRepeated(
      packageName = "com.ogrencisosyalagi.app",
      metrics = listOf(FrameTimingMetric()),
      compilationMode = CompilationMode.Partial(),
      iterations = 10,
      setupBlock = {
        pressHome()
        startActivityAndWait()
      },
      measureBlock = {
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
      },
    )
  }
}
