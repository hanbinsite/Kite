# Generate self-signed code signing certificate for Windows
# Usage: .\scripts\generate-cert.ps1
# Output: apps/desktop/src-tauri/codesign.pfx

$certName = "API Client"
$pfxPath = "apps/desktop/src-tauri/codesign.pfx"
$pfxPassword = "apiclient" # Change in production

# Create self-signed code signing certificate
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName" `
    -FriendlyName "$certName Code Signing" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyUsage DigitalSignature `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3") `
    -KeyLength 4096 `
    -HashAlgorithm SHA256

# Export as PFX
$password = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password

Write-Host "Certificate thumbprint: $($cert.Thumbprint)"
Write-Host "PFX exported to: $pfxPath"
Write-Host ""
Write-Host "Next: Update tauri.conf.json bundle.windows.certificateThumbprint to: $($cert.Thumbprint)"
