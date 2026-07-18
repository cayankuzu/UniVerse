param(
    [Parameter(Mandatory = $true)]
    [string]$BackupRoot,

    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$resolvedBackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path
$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

$items = @(
    ".env",
    "GoogleService-Info.plist",
    ".secrets\\README.md",
    ".secrets\\app_store_push_bildiirm_ke_AuthKey_TRX8Y4P5SU.p8",
    ".secrets\\AuthKey_DC34BUDLPC.p8",
    ".secrets\\universe-da9c4-firebase-adminsdk-fbsvc-382635baf3.json",
    "android\\keystore.properties",
    "android\\app\\debug.keystore",
    "android\\app\\google-services.json",
    "android\\keystores\\sorita-release.jks"
)

foreach ($relativePath in $items) {
    $sourcePath = Join-Path $resolvedBackupRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing backup file: $sourcePath"
    }

    $targetPath = Join-Path $resolvedProjectRoot $relativePath
    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    Write-Output "Restored: $relativePath"
}

Write-Output ""
Write-Output "Secret restore complete."
