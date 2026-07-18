param(
  [string]$Flow = ".maestro/smoke-critical.yaml",
  [string]$AlternateFlow = ".maestro/smoke-auth-shell.yaml",
  [string]$AdbFallbackScript = "utils/ops/run-adb-critical-smoke.ps1"
)

$ErrorActionPreference = "Stop"

$maestro = Get-Command maestro -ErrorAction SilentlyContinue
if (-not $maestro) {
  throw "Maestro CLI bulunamadi. https://maestro.mobile.dev/ adresinden kurup tekrar deneyin."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$flowPaths = @($Flow, $AlternateFlow) |
  Where-Object { $_ } |
  Select-Object -Unique |
  ForEach-Object { Join-Path $repoRoot $_ }

$existingFlowPaths = $flowPaths | Where-Object { Test-Path $_ }
if ($existingFlowPaths.Count -eq 0) {
  throw "Maestro flow bulunamadi. Beklenen pathler: $($flowPaths -join ', ')"
}

Push-Location $repoRoot
try {
  $adbFallbackPath = Join-Path $repoRoot $AdbFallbackScript

  foreach ($candidateFlowPath in $existingFlowPaths) {
    $combinedOutput = & $maestro.Source test $candidateFlowPath 2>&1
    $combinedOutput | ForEach-Object { $_ }

    if ($LASTEXITCODE -eq 0) {
      return
    }

    $joinedOutput = ($combinedOutput | ForEach-Object { $_.ToString() }) -join "`n"
    $shouldFallback =
      $joinedOutput -match "INJECT_EVENTS permission" -or
      $joinedOutput -match "requires INJECT_EVENTS"

    if ($shouldFallback) {
      if (-not (Test-Path $adbFallbackPath)) {
        throw "Maestro fallback script bulunamadi: $adbFallbackPath"
      }

      Write-Warning "Maestro touch injection fiziksel cihaz izinleri nedeniyle basarisiz oldu. ADB fallback smoke calistiriliyor."
      & $adbFallbackPath
      if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
      }
      return
    }

    Write-Warning "Maestro flow basarisiz oldu, alternatif flow denenecek: $candidateFlowPath"
  }

  throw "Maestro critical flow failed."
} finally {
  Pop-Location
}
