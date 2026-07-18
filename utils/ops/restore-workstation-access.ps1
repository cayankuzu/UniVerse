param(
    [string]$BackupRoot = (Join-Path ([Environment]::GetFolderPath("Desktop")) "UniVerse_secrests")
)

$ErrorActionPreference = "Stop"

$resolvedBackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path

$items = @(
    @{
        Source = "workstation-access\.ssh\id_ed25519"
        Target = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
    }
    @{
        Source = "workstation-access\.ssh\id_ed25519.pub"
        Target = Join-Path $env:USERPROFILE ".ssh\id_ed25519.pub"
    }
    @{
        Source = "workstation-access\.ssh\known_hosts"
        Target = Join-Path $env:USERPROFILE ".ssh\known_hosts"
    }
    @{
        Source = "workstation-access\github-cli\config.yml"
        Target = Join-Path $env:APPDATA "GitHub CLI\config.yml"
    }
    @{
        Source = "workstation-access\github-cli\hosts.yml"
        Target = Join-Path $env:APPDATA "GitHub CLI\hosts.yml"
    }
    @{
        Source = "workstation-access\.expo\state.json"
        Target = Join-Path $env:USERPROFILE ".expo\state.json"
    }
)

$codeSigningSourceRoot = Join-Path $resolvedBackupRoot "workstation-access\.expo\codesigning"
if (Test-Path -LiteralPath $codeSigningSourceRoot) {
    Get-ChildItem -Path $codeSigningSourceRoot -Recurse -Force -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($codeSigningSourceRoot.Length).TrimStart('\')
        $items += @{
            Source = "workstation-access\.expo\codesigning\$relativePath"
            Target = Join-Path $env:USERPROFILE ".expo\codesigning\$relativePath"
        }
    }
}

foreach ($item in $items) {
    $sourcePath = Join-Path $resolvedBackupRoot $item.Source
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        continue
    }

    $targetDir = Split-Path -Parent $item.Target
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $item.Target -Force
    Write-Output "Restored: $($item.Source)"
}

Write-Output ""
Write-Output "Workstation continuity restore complete."
