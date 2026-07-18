param(
  [ValidateSet("auto", "device", "emulator", "lan", "tunnel")]
  [string]$Target = "auto",
  [string]$PackageName = "com.ogrencisosyalagi.app",
  [string]$AdbPath = "",
  [int]$MetroPort = 8081,
  [switch]$ClearCache,
  [switch]$LaunchAndroid,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "adb-helpers.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:EXPO_PUBLIC_APP_ENV = "development"
$env:EXPO_PUBLIC_ANDROID_PACKAGE = $PackageName

$resolvedAdbPath = $null
$connectedDevices = @()
$reversedDeviceIds = @()
$resolvedHost = $null

switch ($Target) {
  "lan" {
    $resolvedHost = "lan"
  }
  "tunnel" {
    $resolvedHost = "tunnel"
  }
  default {
    $resolvedAdbPath = Resolve-AdbPath -PreferredPath $AdbPath
    $connectedDevices = @(Get-AdbConnectedDevices -AdbPath $resolvedAdbPath)

    if ($Target -eq "device") {
      $physicalDevices = @($connectedDevices | Where-Object { -not $_.IsEmulator })
      if ($physicalDevices.Count -eq 0) {
        throw "No physical Android device is connected. Connect a device over USB or use start:android:device:lan."
      }

      $reversedDeviceIds = @($physicalDevices | ForEach-Object { $_.Id })
      Enable-AdbReverse -AdbPath $resolvedAdbPath -DeviceIds $reversedDeviceIds -Port $MetroPort
      $resolvedHost = "localhost"
      break
    }

    if ($Target -eq "emulator") {
      $emulators = @($connectedDevices | Where-Object { $_.IsEmulator })
      if ($emulators.Count -eq 0) {
        throw "No Android emulator is connected. Start an emulator first or use start:android:device for USB devices."
      }

      $resolvedHost = "lan"
      break
    }

    if ($connectedDevices.Count -gt 0) {
      $physicalDevices = @($connectedDevices | Where-Object { -not $_.IsEmulator })
      $emulators = @($connectedDevices | Where-Object { $_.IsEmulator })

      if ($physicalDevices.Count -gt 0 -and $emulators.Count -eq 0) {
        $reversedDeviceIds = @($physicalDevices | ForEach-Object { $_.Id })
        if ($reversedDeviceIds.Count -gt 0) {
          Enable-AdbReverse -AdbPath $resolvedAdbPath -DeviceIds $reversedDeviceIds -Port $MetroPort
        }

        $resolvedHost = "localhost"
        break
      }

      $resolvedHost = "lan"
      break
    }

    $resolvedHost = "lan"
  }
}

$expoArgs = @("expo", "start", "--dev-client", "--host", $resolvedHost, "--port", $MetroPort.ToString())
if ($LaunchAndroid) {
  $expoArgs += "--android"
}
if ($ClearCache) {
  $expoArgs += "-c"
}

if ($DryRun) {
  [pscustomobject]@{
    Target = $Target
    Host = $resolvedHost
    LaunchAndroid = [bool]$LaunchAndroid
    ClearCache = [bool]$ClearCache
    MetroPort = $MetroPort
    AdbPath = $resolvedAdbPath
    ConnectedDevices = @($connectedDevices | ForEach-Object { $_.Id })
    ReversedDevices = $reversedDeviceIds
    Command = "npx " + ($expoArgs -join " ")
  } | ConvertTo-Json -Depth 4
  exit 0
}

if ($reversedDeviceIds.Count -gt 0) {
  Write-Output ("Enabled adb reverse for {0} on tcp:{1}." -f ($reversedDeviceIds -join ", "), $MetroPort)
}

Write-Output ("Starting Expo dev client with host '{0}' on port {1}." -f $resolvedHost, $MetroPort)
& npx @expoArgs
exit $LASTEXITCODE
