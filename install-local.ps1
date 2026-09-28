# Audion Companion Plugin - Local Installation Script for Windows
$pluginName = "audion-companion"
$appDataPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ApplicationData)
$audionPluginsDir = Join-Path $appDataPath "audion\plugins"
$targetDir = Join-Path $audionPluginsDir $pluginName

Write-Host "Installing $pluginName to Audion..." -ForegroundColor Cyan
Write-Host "Target directory: $targetDir" -ForegroundColor Gray

if (-not (Test-Path -Path $audionPluginsDir)) {
    Write-Host "Creating Audion plugins folder: $audionPluginsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $audionPluginsDir -Force | Out-Null
}

if (Test-Path -Path $targetDir) {
    Write-Host "Existing installation found. Removing old files..." -ForegroundColor Yellow
    Remove-Item -Path $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Copy-Item -Path "$PSScriptRoot\plugin.json" -Destination $targetDir -Force
Copy-Item -Path "$PSScriptRoot\index.js" -Destination $targetDir -Force

Write-Host ""
Write-Host "Plugin installed successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Open Audion"
Write-Host "  2. Go to Settings > Plugins"
Write-Host "  3. Click 'Reload Plugins' (or restart Audion) and enable 'Audion Companion'."
