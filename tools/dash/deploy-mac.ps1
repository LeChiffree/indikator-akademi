# ==========================================================================
# Indikator Akademi - Analiz Dashboard'unu Mac'e kur/degistir
# Kullanim: powershell -ExecutionPolicy Bypass -File tools\dash\deploy-mac.ps1
# Hedef: berfin@192.168.1.102  (~/indikator-akademi/tools/dash, port 8090)
# ==========================================================================
$ErrorActionPreference = 'Stop'
$Key = "$env:USERPROFILE\.ssh\paper_ml_macbook"
$Dest = 'berfin@192.168.1.102'
$Src = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # proje koku
$Dash = Join-Path $Src 'tools\dash'
$Remote = '~/indikator-akademi/tools/dash'

if (-not (Test-Path $Key)) { Write-Host "SSH anahtari yok: $Key" -ForegroundColor Red; exit 1 }

Write-Host "1/4 Uzak klasorler..."
ssh -i $Key $Dest "mkdir -p $Remote/data/agg $Remote/web/fonts"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "2/4 Dosyalar aktariliyor (web + meta + agg)..."
scp -i $Key -C "$Dash\server.py" "$Dash\README.md" "${Dest}:indikator-akademi/tools/dash/"
if ($LASTEXITCODE -ne 0) { exit 1 }
scp -i $Key -C "$Dash\data\meta.json" "$Dash\data\scenarios.json" "$Dash\data\fng.csv" "${Dest}:indikator-akademi/tools/dash/data/"
if ($LASTEXITCODE -ne 0) { exit 1 }
scp -i $Key -C -r "$Dash\web" "${Dest}:indikator-akademi/tools/dash/"
if ($LASTEXITCODE -ne 0) { exit 1 }
scp -i $Key -C -r "$Dash\data\agg" "${Dest}:indikator-akademi/tools/dash/data/"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "3/4 Python bagimliliklari + servis yeniden baslatiliyor..."
$sh = @'
python3 - <<'PY'
import importlib.util, subprocess, sys
need = [m for m in ('numpy', 'fastapi', 'uvicorn') if importlib.util.find_spec(m) is None]
if need:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--user', '--quiet', *need])
print('deps ok')
PY
pkill -f "tools/dash/server.py" 2>/dev/null || true
sleep 1
cd ~/indikator-akademi || exit 1
DASH_PORT=8090 nohup python3 tools/dash/server.py >> tools/dash/dash.log 2>&1 < /dev/null &
sleep 3
lsof -nP -iTCP:8090 -sTCP:LISTEN | head -2 || true
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sh))
ssh -i $Key $Dest "echo $b64 | base64 -D | bash"
if ($LASTEXITCODE -ne 0) { Write-Host "Servis baslatilamadi." -ForegroundColor Red; exit 1 }

Write-Host "4/4 Saglik kontrolu..."
Start-Sleep -Seconds 2
try {
  $r = Invoke-WebRequest 'http://192.168.1.102:8090/api/meta' -UseBasicParsing -TimeoutSec 10
  Write-Host "Tamam: HTTP $($r.StatusCode)  ->  http://192.168.1.102:8090/" -ForegroundColor Green
} catch {
  Write-Host "Yanit yok: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
