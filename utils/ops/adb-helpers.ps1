Set-StrictMode -Version Latest

function Resolve-AdbPath {
  param(
    [string]$PreferredPath = ""
  )

  $candidates = [System.Collections.Generic.List[string]]::new()

  foreach ($candidate in @(
      $PreferredPath,
      $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME "platform-tools\adb.exe" }),
      $(if ($env:ANDROID_SDK_ROOT) { Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe" }),
      $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe" })
    )) {
    if ($candidate -and -not $candidates.Contains($candidate)) {
      $candidates.Add($candidate)
    }
  }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if ($adbCommand) {
    return $adbCommand.Source
  }

  throw "adb could not be resolved. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install Android platform-tools."
}

function Get-AdbConnectedDevices {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath
  )

  $devices = [System.Collections.Generic.List[object]]::new()

  foreach ($line in (& $AdbPath devices)) {
    if (-not $line -or $line -match "^\s*$" -or $line -match "^List of devices attached") {
      continue
    }

    $parts = $line -split "\s+"
    if ($parts.Count -lt 2) {
      continue
    }

    $deviceId = $parts[0].Trim()
    $state = $parts[1].Trim()

    if ($state -ne "device") {
      continue
    }

    $devices.Add([pscustomobject]@{
        Id = $deviceId
        State = $state
        IsEmulator = $deviceId -like "emulator-*"
      })
  }

  return $devices
}

function Enable-AdbReverse {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [string[]]$DeviceIds = @(),
    [int]$Port = 8081
  )

  $uniqueDeviceIds = $DeviceIds | Where-Object { $_ } | Select-Object -Unique
  foreach ($deviceId in $uniqueDeviceIds) {
    & $AdbPath -s $deviceId reverse "tcp:$Port" "tcp:$Port" | Out-Null
  }
}
