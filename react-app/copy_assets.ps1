$source = "C:\Users\parvb\.gemini\antigravity\brain\50ff2255-50ea-4e91-b871-9711d81a319c"
$dest = "f:\AapKaBakaya\react-app\public\assets"
if (!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force }
Copy-Item "$source\hero_background_abstract_final_1771278536036.png" -Destination "$dest\hero-bg.png" -Force
Copy-Item "$source\features_background_1771276655107.png" -Destination "$dest\features-bg.png" -Force
Copy-Item "$source\cta_background_1771276730307.png" -Destination "$dest\cta-bg.png" -Force
Write-Host "Assets Copied Successfully"
