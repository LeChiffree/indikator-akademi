# ==========================================================================
# Indikator Akademi - Mac'e aktarim + servisi yeniden baslatma
# Kullanim:  powershell -ExecutionPolicy Bypass -File tools\deploy-mac.ps1
# Hedef:     berfin@192.168.1.102  (~/indikator-akademi, launchd servisi)
# On kosul:  ~/.ssh/paper_ml_macbook anahtari (berfin kullanicisinda yetkili)
# ==========================================================================
$ErrorActionPreference = 'Stop'
$Key  = "$env:USERPROFILE\.ssh\paper_ml_macbook"
$Dest = 'berfin@192.168.1.102'
$Src  = Split-Path -Parent $PSScriptRoot   # proje koku

if (-not (Test-Path $Key)) {
  Write-Host "SSH anahtari bulunamadi: $Key" -ForegroundColor Red
  exit 1
}

Write-Host "1/3 Aktariliyor: $Src  ->  ${Dest}:indikator-akademi/"
scp -i $Key -C -r "$Src\assets" "$Src\tools" "$Src\index.html" "$Src\manifest.webmanifest" "$Src\package.json" "$Src\README.md" "$Src\BACKTEST-RAPORU.md" "$Src\serve.py" "${Dest}:indikator-akademi/"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aktarim basarisiz (scp kodu: $LASTEXITCODE)." -ForegroundColor Red
  exit 1
}

Write-Host "2/3 Servis yeniden baslatiliyor (launchd)..."
ssh -i $Key $Dest 'launchctl kickstart -k gui/$(id -u)/com.indikatorakademi.server 2>/dev/null || launchctl kickstart -k user/$(id -u)/com.indikatorakademi.server'
if ($LASTEXITCODE -ne 0) {
  Write-Host "Servis yeniden baslatilamadi - Mac'te servis kurulu mu?" -ForegroundColor Yellow
  exit 1
}

Write-Host "3/3 Saglik kontrolu..."
Start-Sleep -Seconds 2
try {
  $r = Invoke-WebRequest 'http://192.168.1.102:8080/' -UseBasicParsing -TimeoutSec 8
  Write-Host "Tamam: HTTP $($r.StatusCode)  ->  http://192.168.1.102:8080/" -ForegroundColor Green
} catch {
  Write-Host "Sunucu yanit vermedi: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
