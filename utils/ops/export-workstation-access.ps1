param(
    [string]$BackupRoot = (Join-Path ([Environment]::GetFolderPath("Desktop")) "UniVerse_secrests")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupRoot)) {
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
}

$resolvedBackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path

$items = @(
    @{
        Source = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
        Target = "workstation-access\.ssh\id_ed25519"
        Required = $false
    }
    @{
        Source = Join-Path $env:USERPROFILE ".ssh\id_ed25519.pub"
        Target = "workstation-access\.ssh\id_ed25519.pub"
        Required = $false
    }
    @{
        Source = Join-Path $env:USERPROFILE ".ssh\known_hosts"
        Target = "workstation-access\.ssh\known_hosts"
        Required = $false
    }
    @{
        Source = Join-Path $env:APPDATA "GitHub CLI\config.yml"
        Target = "workstation-access\github-cli\config.yml"
        Required = $false
    }
    @{
        Source = Join-Path $env:APPDATA "GitHub CLI\hosts.yml"
        Target = "workstation-access\github-cli\hosts.yml"
        Required = $false
    }
    @{
        Source = Join-Path $env:USERPROFILE ".expo\state.json"
        Target = "workstation-access\.expo\state.json"
        Required = $false
    }
)

$expoCodeSigningRoot = Join-Path $env:USERPROFILE ".expo\codesigning"
if (Test-Path -LiteralPath $expoCodeSigningRoot) {
    Get-ChildItem -Path $expoCodeSigningRoot -Recurse -Force -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($expoCodeSigningRoot.Length).TrimStart('\')
        $items += @{
            Source = $_.FullName
            Target = "workstation-access\.expo\codesigning\$relativePath"
            Required = $false
        }
    }
}

$exported = @()
$missing = @()

foreach ($item in $items) {
    if (-not (Test-Path -LiteralPath $item.Source)) {
        if ($item.Required) {
            throw "Missing required workstation continuity file: $($item.Source)"
        }
        $missing += $item.Source
        continue
    }

    $targetPath = Join-Path $resolvedBackupRoot $item.Target
    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $item.Source -Destination $targetPath -Force
    $exported += $item.Target
    Write-Output "Exported: $($item.Target)"
}

$notesPath = Join-Path $resolvedBackupRoot "workstation-access\README.txt"
$notesDir = Split-Path -Parent $notesPath
if (-not (Test-Path -LiteralPath $notesDir)) {
    New-Item -ItemType Directory -Force -Path $notesDir | Out-Null
}

$notes = @(
    "Workstation continuity export",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "",
    "Included files help restore local SSH and CLI state.",
    "They do not guarantee that OS keychain-backed sessions will remain valid after a format.",
    "",
    "Still external / manual after restore:",
    "- GitHub CLI token may still require manual login because the active token is stored in the OS keyring.",
    "- Expo/EAS login may still require manual login because session material can depend on OS-backed secret storage.",
    "- Supabase CLI auth is not exported because no local token file was found.",
    "- Apple Developer / App Store Connect account access remains external.",
    "- Google Play Console access and the Play-held app signing key remain external.",
    "",
    "Restore command:",
    "powershell -ExecutionPolicy Bypass -File .\utils\ops\restore-workstation-access.ps1 -BackupRoot `"$resolvedBackupRoot`"",
    "",
    "Exported files:"
)

if ($exported.Count -eq 0) {
    $notes += "- none"
} else {
    $exported | ForEach-Object { $notes += "- $_" }
}

if ($missing.Count -gt 0) {
    $notes += ""
    $notes += "Missing optional files during export:"
    $missing | ForEach-Object { $notes += "- $_" }
}

Set-Content -LiteralPath $notesPath -Value $notes -Encoding ASCII

Write-Output ""
Write-Output "Workstation continuity export complete: $resolvedBackupRoot"
