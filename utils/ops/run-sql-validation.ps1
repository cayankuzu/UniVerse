param(
  [string]$ConnectionString = "",
  [string]$ValidationDir = "supabase/validation"
)

function Resolve-SupabaseCliCommand {
  $supabase = Get-Command supabase -ErrorAction SilentlyContinue
  if ($supabase) {
    return @{
      FilePath = $supabase.Source
      Args = @()
    }
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    return @{
      FilePath = $npm.Source
      Args = @("exec", "--yes", "--", "supabase")
    }
  }

  return $null
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedValidationDir = Resolve-Path (Join-Path $root $ValidationDir)
$databaseUrl = $ConnectionString

if (-not $databaseUrl) {
  $databaseUrl = $env:SUPABASE_DB_URL
}
if (-not $databaseUrl) {
  $databaseUrl = $env:DATABASE_URL
}
$psql = Get-Command psql -ErrorAction SilentlyContinue
$supabaseCli = Resolve-SupabaseCliCommand

$files = Get-ChildItem -Path $resolvedValidationDir -Filter "*.sql" | Sort-Object Name
if (-not $files) {
  throw "SQL validation dosyasi bulunamadi: $resolvedValidationDir"
}

foreach ($file in $files) {
  Write-Output "[sql-validation] running $($file.Name)"
  if ($databaseUrl -and $psql) {
    & $psql.Source $databaseUrl -v ON_ERROR_STOP=1 -f $file.FullName
  } elseif ($supabaseCli) {
    & $supabaseCli.FilePath @($supabaseCli.Args + @("db", "query", "--linked", "-f", $file.FullName))
  } else {
    throw "SQL validation icin psql veya Supabase CLI gerekli."
  }
  if ($LASTEXITCODE -ne 0) {
    throw "SQL validation basarisiz oldu: $($file.Name)"
  }
}

Write-Output "[sql-validation] completed successfully."
