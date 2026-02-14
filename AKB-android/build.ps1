$env:JAVA_HOME = "f:\AapKaBakaya\jdk-17"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ANDROID_HOME = "f:\AapKaBakaya\android-sdk"
$env:ANDROID_SDK_ROOT = "f:\AapKaBakaya\android-sdk"

Write-Host "----------------------------------------------------------------"
Write-Host "           AapKaBakaya Android Build Script                     "
Write-Host "----------------------------------------------------------------"
Write-Host "JAVA_HOME set to: $env:JAVA_HOME"

# Check for global bubblewrap
$BwCmd = Get-Command bubblewrap -ErrorAction SilentlyContinue

if ($BwCmd) {
    Write-Host "Found Bubblewrap at: $($BwCmd.Source)"
    $Exec = $BwCmd.Source
    $UpdateArgs = @("update")
    $BuildArgs = @("build")
} else {
    Write-Host "Global Bubblewrap not found. Using npx..."
    $Exec = "npx"
    $UpdateArgs = @("--yes", "@bubblewrap/cli", "update")
    $BuildArgs = @("--yes", "@bubblewrap/cli", "build")
}

# 1. Update Project Structure
Write-Host "`n[1/2] Updating Project Configuration..."
Write-Host "NOTE: If asked for 'versionName', just press ENTER."
& $Exec update

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Update finished with code $LASTEXITCODE. Continuing..."
}

# 2. Configure Local Properties for Gradle
Write-Host "`n[2/2] Configuring Gradle..."
$LocalProp = "f:\AapKaBakaya\AKB-android\local.properties"
"sdk.dir=f:\\AapKaBakaya\\android-sdk" | Out-File -Encoding ASCII $LocalProp
Write-Host "Created local.properties pointing to manual SDK."

# 3. Build with Gradle Directly (Bypasing Bubblewrap check)
Write-Host "`n[3/3] Building with Gradle..."
if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat bundleRelease
} else {
    Write-Error "gradlew.bat not found! 'bubblewrap update' failed to create project files."
    exit 1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS! Build complete."
    Write-Host "File location: f:\AapKaBakaya\AKB-android\app\build\outputs\bundle\release\app-release.aab"
    # Note: Bubblewrap build signs it. Gradle assembleRelease might not sign it if config is missing?
    # Bubblewrap puts signing config in app/build.gradle usually.
    # If signed, it's app-release.aab or apk.
    # Actually 'bundleRelease' generates .aab. 'assembleRelease' generates .apk.
    # We want .aab.
} else {
    Write-Error "`nBuild failed."
}

Read-Host "Press Enter to exit..."
