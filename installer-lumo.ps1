# Lumo : installe les outils nécessaires, compile l'application et lance l'installeur.
# Utilisation (depuis le dossier lumo) :  clic droit > Exécuter avec PowerShell
#   ou  : powershell -ExecutionPolicy Bypass -File .\installer-lumo.ps1        (compile + installe)
#         powershell -ExecutionPolicy Bypass -File .\installer-lumo.ps1 -Dev   (lance sans installer, pour tester)
param([switch]$Dev)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function RefreshPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.cargo\bin"
}

if (-not (Has winget)) { throw "winget est introuvable. Installe « App Installer » depuis le Microsoft Store, puis relance ce script." }

# 1. Outils C++ de Microsoft (nécessaires pour compiler Rust sous Windows)
Step "Outils de compilation C++ (Visual Studio Build Tools)"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVC = (Test-Path $vswhere) -and (& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
if ($hasVC) { Write-Host "Déjà installés." }
else {
  Write-Host "Installation (plusieurs Go, 10-20 min)..."
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-source-agreements --accept-package-agreements `
    --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
}

# 2. Node.js
Step "Node.js"
if (Has node) { Write-Host "Déjà installé : $(node -v)" }
else { winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements; RefreshPath }

# 3. Rust
Step "Rust"
RefreshPath
if (Has cargo) { Write-Host "Déjà installé : $(cargo -V)" }
else {
  winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
  RefreshPath
  rustup default stable-msvc
}

# 4. WebView2 (déjà présent sur Windows 10 récent et Windows 11)
Step "WebView2"
$wv = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if ($wv) { Write-Host "Déjà installé." } else { winget install --id Microsoft.EdgeWebView2Runtime -e --accept-source-agreements --accept-package-agreements }

# 5. Dépendances du projet
Step "Dépendances du projet (npm install)"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install a échoué." }

if ($Dev) {
  Step "Lancement de Lumo en mode test (Ctrl+C pour arrêter)"
  npm run tauri dev
  exit $LASTEXITCODE
}

# 6. Compilation (la première fois : 5-15 min)
Step "Compilation de Lumo"
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "La compilation a échoué : copie le message d'erreur ci-dessus à Claude." }

# 7. Installation
$setup = Get-ChildItem "src-tauri\target\release\bundle\nsis\*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Step "Installeur prêt : $($setup.FullName)"
Copy-Item $setup.FullName -Destination $PSScriptRoot -Force
Start-Process $setup.FullName
Write-Host "`nUne fois installé, Lumo se lance depuis le menu Démarrer (« Lumo »)." -ForegroundColor Green
