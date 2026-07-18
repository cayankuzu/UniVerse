param(
  [string]$PackageName = "com.ogrencisosyalagi.app",
  [string]$AdbPath = "",
  [int]$LaunchWaitSeconds = 8,
  [int]$RetryCount = 12,
  [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "adb-helpers.ps1")

$AdbPath = Resolve-AdbPath -PreferredPath $AdbPath

function Get-UiSnapshot {
  param(
    [string]$DumpPath = "/sdcard/critical-smoke.xml"
  )

  & $AdbPath shell uiautomator dump $DumpPath | Out-Null
  $xmlLines = & $AdbPath shell cat $DumpPath
  if (-not $xmlLines) {
    throw "UI dump is empty."
  }

  return [xml]($xmlLines -join "`n")
}

function Add-UiNodes {
  param(
    [System.Xml.XmlNode]$Node,
    [System.Collections.Generic.List[object]]$Collector
  )

  if ($Node.Name -eq "node") {
    $Collector.Add([pscustomobject]@{
        Text = [string]$Node.GetAttribute("text")
        Description = [string]$Node.GetAttribute("content-desc")
        ResourceId = [string]$Node.GetAttribute("resource-id")
        Bounds = [string]$Node.GetAttribute("bounds")
        Class = [string]$Node.GetAttribute("class")
      })
  }

  foreach ($child in $Node.ChildNodes) {
    Add-UiNodes -Node $child -Collector $Collector
  }
}

function Get-UiNodes {
  param(
    [xml]$Snapshot
  )

  $collector = [System.Collections.Generic.List[object]]::new()
  Add-UiNodes -Node $Snapshot.DocumentElement -Collector $collector
  return $collector
}

function Find-UiNode {
  param(
    [object[]]$Nodes,
    [string]$Text,
    [string]$ResourceId
  )

  if ($Text) {
    return $Nodes |
      Where-Object { $_.Text -eq $Text -or $_.Description -eq $Text } |
      Select-Object -First 1
  }

  if ($ResourceId) {
    return $Nodes |
      Where-Object {
        $_.ResourceId -eq $ResourceId -or
        $_.ResourceId -eq "$PackageName:id/$ResourceId"
      } |
      Select-Object -First 1
  }

  return $null
}

function Get-VisibleLabels {
  param(
    [object[]]$Nodes
  )

  return (
    $Nodes |
      ForEach-Object { @($_.Text, $_.Description) } |
      Where-Object { $_ -and $_.Trim() } |
      Select-Object -Unique |
      Select-Object -First 40
  ) -join ", "
}

function Wait-ForUiNode {
  param(
    [string]$Text,
    [string]$ResourceId,
    [int]$Retries = $RetryCount,
    [int]$DelaySeconds = $RetryDelaySeconds
  )

  for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
    $snapshot = Get-UiSnapshot
    $nodes = Get-UiNodes -Snapshot $snapshot
    $match = Find-UiNode -Nodes $nodes -Text $Text -ResourceId $ResourceId
    if ($match) {
      return [pscustomobject]@{
        Node = $match
        Nodes = $nodes
      }
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  $snapshot = Get-UiSnapshot
  $nodes = Get-UiNodes -Snapshot $snapshot
  $available = Get-VisibleLabels -Nodes $nodes
  throw "UI node not found. text='$Text' resourceId='$ResourceId'. Visible labels: $available"
}

function Get-BoundsCenter {
  param(
    [string]$Bounds
  )

  if ($Bounds -notmatch "\[(\d+),(\d+)\]\[(\d+),(\d+)\]") {
    throw "Invalid bounds: $Bounds"
  }

  $left = [int]$matches[1]
  $top = [int]$matches[2]
  $right = [int]$matches[3]
  $bottom = [int]$matches[4]

  return [pscustomobject]@{
    X = [int](($left + $right) / 2)
    Y = [int](($top + $bottom) / 2)
  }
}

function Tap-UiNode {
  param(
    [string]$Text,
    [string]$ResourceId
  )

  $snapshot = Wait-ForUiNode -Text $Text -ResourceId $ResourceId
  $center = Get-BoundsCenter -Bounds $snapshot.Node.Bounds
  & $AdbPath shell input tap $center.X $center.Y | Out-Null
  Start-Sleep -Milliseconds 1200
}

& $AdbPath shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds $LaunchWaitSeconds

$appPid = (& $AdbPath shell pidof $PackageName).Trim()
if (-not $appPid) {
  throw "App is not running after launch."
}

Wait-ForUiNode -Text "UniVerse" | Out-Null
Wait-ForUiNode -Text "Ana Sayfa" | Out-Null
Wait-ForUiNode -Text "Ara" | Out-Null
Wait-ForUiNode -Text "Profil" | Out-Null
Wait-ForUiNode -Text "Bildirimler" | Out-Null
Wait-ForUiNode -ResourceId "home-feed-filter-button" | Out-Null

Write-Output "ADB_CRITICAL_SMOKE_OK PID=$appPid"
