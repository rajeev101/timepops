param([string]$Source)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$brandDirectory = Join-Path $root 'assets/brand'
[System.IO.Directory]::CreateDirectory($brandDirectory) | Out-Null
$original = Join-Path $brandDirectory 'emblem-source.png'
if ($Source -and [System.IO.Path]::GetFullPath($Source) -ne $original) {
    Copy-Item -LiteralPath $Source -Destination $original
}
if (!(Test-Path -LiteralPath $original)) {
    throw 'Provide the original emblem using -Source.'
}

$image = [System.Drawing.Image]::FromFile($original)
try {
    function Export-Logo {
        param([int]$Size, [string]$Destination, [double]$Scale = 1.0)
        [System.IO.Directory]::CreateDirectory((Split-Path $Destination -Parent)) | Out-Null
        $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $ratio = [Math]::Min($Size / $image.Width, $Size / $image.Height) * $Scale
            $width = [int][Math]::Round($image.Width * $ratio)
            $height = [int][Math]::Round($image.Height * $ratio)
            $graphics.DrawImage($image, [int](($Size - $width) / 2), [int](($Size - $height) / 2), $width, $height)
            $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
        $check = [System.Drawing.Image]::FromFile($Destination)
        try {
            if ($check.Width -ne $Size -or $check.Height -ne $Size) { throw "Invalid asset dimensions: $Destination" }
        } finally { $check.Dispose() }
        Write-Output "Generated ${Size}x${Size}: $Destination"
    }

    Export-Logo 512 (Join-Path $brandDirectory 'logo.png')
    $densities = @{'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4}
    foreach ($density in $densities.GetEnumerator()) {
        $directory = Join-Path $root "android/app/src/main/res/mipmap-$($density.Key)"
        Export-Logo ([int](48 * $density.Value)) (Join-Path $directory 'ic_launcher.png')
        Export-Logo ([int](48 * $density.Value)) (Join-Path $directory 'ic_launcher_round.png')
        Export-Logo ([int](108 * $density.Value)) (Join-Path $directory 'ic_launcher_foreground.png') (2.0 / 3.0)
    }
    $icons = Join-Path $root 'ios/RNApp/Images.xcassets/AppIcon.appiconset'
    foreach ($size in @(20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024)) {
        Export-Logo $size (Join-Path $icons "AppIcon-$size.png")
    }
} finally { $image.Dispose() }