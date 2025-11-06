# Add hosts file entries for local development environment
# Run as Administrator
# Usage: .\windows-add-hosts.ps1 172.17.0.2 dev-001

param(
    [Parameter(Mandatory=$true)]
    [string]$DevContainerIP,
    
    [Parameter(Mandatory=$true)]
    [string]$EnvName
)

$hostsFile = "C:\Windows\System32\drivers\etc\hosts"

$entries = @"

# Demiurge Local Dev - Environment $EnvName
$DevContainerIP  $EnvName.local
$DevContainerIP  ganymede.$EnvName.local
$DevContainerIP  gateway.$EnvName.local
"@

# Check if already exists
$content = Get-Content $hostsFile -Raw
if ($content -match "# Demiurge Local Dev - Environment $EnvName") {
    Write-Host "⚠️  Entries for $EnvName already exist in hosts file"
    Write-Host "   Remove them first or edit manually"
    exit 1
}

# Append
Add-Content -Path $hostsFile -Value $entries

Write-Host "✅ Added hosts entries for $EnvName"
Write-Host "   $EnvName.local"
Write-Host "   ganymede.$EnvName.local"
Write-Host "   gateway.$EnvName.local"
Write-Host ""
Write-Host "💡 Flush DNS cache:"
Write-Host "   ipconfig /flushdns"
Write-Host ""
Write-Host "💡 Test connection:"
Write-Host "   ping $EnvName.local"

