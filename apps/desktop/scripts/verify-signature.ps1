param(
  [string]$Path = ""
)

# Проверка подписи собранного установщика NATL.
# Запуск: npm run verify:sign

if (-not $Path) {
  $dist = Join-Path $PSScriptRoot "..\dist"
  if (-not (Test-Path $dist)) {
    Write-Error "Папка dist не найдена. Сначала соберите приложение: npm run build"
    exit 1
  }
  $candidate = Get-ChildItem -Path $dist -Filter "NATL Setup*.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $candidate) {
    Write-Error "В dist нет установщика NATL Setup*.exe"
    exit 1
  }
  $Path = $candidate.FullName
}

Write-Host "Файл: $Path"
$signature = Get-AuthenticodeSignature -FilePath $Path

Write-Host "Статус: $($signature.Status)"
if ($signature.SignerCertificate) {
  Write-Host "Издатель: $($signature.SignerCertificate.Subject)"
  Write-Host "Действует до: $($signature.SignerCertificate.NotAfter)"
} else {
  Write-Host "Подписи нет: сборка неподписанная."
  Write-Host "Как включить: docs/compliance/signing.md"
}

if ($signature.Status -ne "Valid") {
  exit 1
}
