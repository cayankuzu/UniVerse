param(
  [string]$PackageName = "com.ogrencisosyalagi.app",
  [string]$AdbPath = "",
  [int]$MetroPort = 8081,
  [int]$MetroStartupRetries = 24,
  [int]$MetroStartupDelaySeconds = 5,
  [int]$AppStartupWaitSeconds = 12
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "adb-helpers.ps1")

$AdbPath = Resolve-AdbPath -PreferredPath $AdbPath

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$logDir = Join-Path $repoRoot ".expo-export-test"
$stdout = Join-Path $logDir "metro.stdout.log"
$stderr = Join-Path $logDir "metro.stderr.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue

$metro = $null

try {
  $metro = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx expo start --dev-client --host localhost --port $MetroPort" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt $MetroStartupRetries; $i++) {
    Start-Sleep -Seconds $MetroStartupDelaySeconds
    try {
      $status = Invoke-WebRequest -Uri "http://127.0.0.1:$MetroPort/status" -UseBasicParsing -TimeoutSec 3
      $content = if ($status.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($status.Content)
      } else {
        [string]$status.Content
      }
      if ($content -match "packager-status:running") {
        $ready = $true
        break
      }
    } catch {
    }
  }

  if (-not $ready) {
    throw "Metro did not become ready on port $MetroPort."
  }

  & $AdbPath reverse "tcp:$MetroPort" "tcp:$MetroPort" | Out-Null
  & $AdbPath logcat -c
  & $AdbPath shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
  Start-Sleep -Seconds $AppStartupWaitSeconds

  $appPid = (& $AdbPath shell pidof $PackageName).Trim()
  $logs = (& $AdbPath logcat -d) | Select-String -Pattern "FATAL EXCEPTION|AndroidRuntime|Unable to load script|ReactNativeJS|$PackageName"
  $fatal = $logs | Select-String -Pattern "FATAL EXCEPTION|Unable to load script|Process:\s+$PackageName"

  if ($fatal) {
    $logs | ForEach-Object { $_.ToString() }
    throw "Device dev smoke failed: fatal startup error detected."
  }

  if (-not $appPid) {
    $logs | ForEach-Object { $_.ToString() }
    throw "Device dev smoke failed: app is not running after launch."
  }

  Write-Output "DEVICE_DEV_SMOKE_OK PID=$appPid"
  $logs | ForEach-Object { $_.ToString() }
} finally {
  if ($metro -and -not $metro.HasExited) {
    Stop-Process -Id $metro.Id -Force -ErrorAction SilentlyContinue
  }
}
