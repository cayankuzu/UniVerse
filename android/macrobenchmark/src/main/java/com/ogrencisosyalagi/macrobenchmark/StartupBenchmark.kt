package com.ogrencisosyalagi.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
  @get:Rule val benchmarkRule = MacrobenchmarkRule()

  @Test
  fun coldStartup() = measureStartup(CompilationMode.Partial(), StartupMode.COLD)

  @Test
  fun coldStartupWithoutProfile() = measureStartup(CompilationMode.None(), StartupMode.COLD)

  @Test
  fun warmStartup() = measureStartup(CompilationMode.Partial(), StartupMode.WARM)

  @Test
  fun hotStartup() = measureStartup(CompilationMode.Partial(), StartupMode.HOT)

  private fun measureStartup(compilationMode: CompilationMode, startupMode: StartupMode) {
    benchmarkRule.measureRepeated(
      packageName = targetPackageName(),
      metrics = listOf(StartupTimingMetric()),
      compilationMode = compilationMode,
      startupMode = startupMode,
      iterations = 10,
      setupBlock = { pressHome() },
      measureBlock = { startActivityAndWait() },
    )
  }
}

private fun targetPackageName() = "com.ogrencisosyalagi.app"
