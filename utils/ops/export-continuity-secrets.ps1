param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$BackupRoot = (Join-Path ([Environment]::GetFolderPath("Desktop")) "UniVerse_secrests")
)

$ErrorActionPreference = "Stop"

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

if (-not (Test-Path -LiteralPath $BackupRoot)) {
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
}

$resolvedBackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path

foreach ($relativePath in $items) {
    $sourcePath = Join-Path $resolvedProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing continuity file: $sourcePath"
    }

    $targetPath = Join-Path $resolvedBackupRoot $relativePath
    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    Write-Output "Exported: $relativePath"
}

$manifestPath = Join-Path $resolvedBackupRoot "continuity-manifest.txt"
$manifestLines = @(
    "UniVerse continuity export",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    ""
)

foreach ($relativePath in $items) {
    $targetPath = Join-Path $resolvedBackupRoot $relativePath
    $hash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
    $manifestLines += "$hash  $relativePath"
}

$manifestLines += ""
$manifestLines += "Restore command:"
$manifestLines += "powershell -ExecutionPolicy Bypass -File .\\utils\\ops\\restore-private-secrets.ps1 -BackupRoot `"$resolvedBackupRoot`" -ProjectRoot `"<repo-path>`""

Set-Content -LiteralPath $manifestPath -Value $manifestLines -Encoding ASCII

Write-Output ""
Write-Output "Continuity export complete: $resolvedBackupRoot"
