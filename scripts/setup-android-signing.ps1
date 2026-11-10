param(
    [string]$Repository = 'rajeev101/timepops',
    [string]$KeystorePath = (Join-Path $env:USERPROFILE '.android\studentai-upload.p12'),
    [string]$KeyAlias = 'studentai-upload'
)

$ErrorActionPreference = 'Stop'
Get-Command gh, keytool -ErrorAction Stop | Out-Null

function Set-RepositorySecret {
    param([string]$Name, [string]$Value)
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Get-Command gh -ErrorAction Stop).Source
    $startInfo.Arguments = "secret set $Name --repo $Repository"
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $secretProcess = [System.Diagnostics.Process]::Start($startInfo)
    try {
        $secretProcess.StandardInput.Write($Value)
        $secretProcess.StandardInput.Close()
        $secretProcess.WaitForExit()
        if ($secretProcess.ExitCode -ne 0) {
            throw "Could not set repository secret $Name."
        }
    } finally {
        $secretProcess.Dispose()
    }
}

$password = Read-Host 'Signing password (12+ characters; save in your password manager)' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $password).Password
$previousPassword = $env:ANDROID_KEYSTORE_PASSWORD

try {
    if ($plainPassword.Length -lt 12) {
        throw 'Use a signing password of at least 12 characters.'
    }
    $env:ANDROID_KEYSTORE_PASSWORD = $plainPassword
    $KeystorePath = [System.IO.Path]::GetFullPath($KeystorePath)
    if (!(Test-Path -LiteralPath $KeystorePath)) {
        $confirmation = Read-Host 'Confirm signing password' -AsSecureString
        try {
            $confirmedPassword = [System.Net.NetworkCredential]::new('', $confirmation).Password
            if ($plainPassword -cne $confirmedPassword) {
                throw 'Signing passwords do not match.'
            }
        } finally {
            $confirmation.Dispose()
            $confirmedPassword = $null
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $KeystorePath) | Out-Null
        & keytool -genkeypair -noprompt -storetype PKCS12 -keystore $KeystorePath `
            -alias $KeyAlias -keyalg RSA -keysize 3072 -validity 10000 `
            -storepass:env ANDROID_KEYSTORE_PASSWORD -keypass:env ANDROID_KEYSTORE_PASSWORD `
            -dname 'CN=StudentAI Android, O=StudentAI, C=IN'
    } else {
        & keytool -list -keystore $KeystorePath -alias $KeyAlias -storepass:env ANDROID_KEYSTORE_PASSWORD
    }
    if ($LASTEXITCODE -ne 0) {
        throw 'Signing key generation or verification failed. Existing keys were not overwritten.'
    }
    Set-RepositorySecret 'ANDROID_KEYSTORE_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($KeystorePath)))
    Set-RepositorySecret 'ANDROID_KEYSTORE_PASSWORD' $plainPassword
    Set-RepositorySecret 'ANDROID_KEY_ALIAS' $KeyAlias
    Set-RepositorySecret 'ANDROID_KEY_PASSWORD' $plainPassword
    Write-Host "Signing secrets configured for $Repository."
    Write-Host "Back up $KeystorePath and its password separately in secure storage."
} finally {
    $env:ANDROID_KEYSTORE_PASSWORD = $previousPassword
    $plainPassword = $null
    $password.Dispose()
}