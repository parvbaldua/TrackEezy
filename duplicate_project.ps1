$source = Get-Location
$dest = "$((Get-Item .).Parent.FullName)\ginto"
Write-Host "Copying from $source to $dest"
Copy-Item -Path $source -Destination $dest -Recurse -Force
Write-Host "Copy complete"
