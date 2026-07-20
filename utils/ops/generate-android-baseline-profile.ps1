$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$androidRoot = Join-Path $repoRoot "android"
$outputRoot = Join-Path $androidRoot "macrobenchmark\build\outputs"
$destination = Join-Path $androidRoot "app\src\main\baseline-prof.txt"

Push-Location $androidRoot
try {
  & .\gradlew.bat :macrobenchmark:connectedBenchmarkAndroidTest "-Pandroid.testInstrumentationRunnerArguments.class=com.ogrencisosyalagi.macrobenchmark.BaselineProfileGenerator"
  if ($LASTEXITCODE -ne 0) {
    throw "Baseline Profile instrumentation failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

$generatedProfile = Get-ChildItem -LiteralPath $outputRoot -Recurse -File |
  Where-Object { $_.Name -like "*baseline-prof.txt" } |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

if (-not $generatedProfile) {
  throw "Baseline Profile output was not produced under $outputRoot."
}

Copy-Item -LiteralPath $generatedProfile.FullName -Destination $destination -Force
Write-Output "Baseline Profile updated: $destination"
