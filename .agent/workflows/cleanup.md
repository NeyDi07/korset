---
description: Clean up junk files, build artifacts, and temporary files from the Körset project
---

// turbo-all

This workflow auto-runs all terminal commands without requiring manual approval.

## Steps

1. Remove build artifacts and cache:
```powershell
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue; Write-Host "dist cleared"
```

2. Remove any accidentally committed zip/archive folders:
```powershell
Get-ChildItem -Directory | Where-Object { $_.Name -match "-main$|-master$|\.zip$" } | Remove-Item -Recurse -Force; Write-Host "Archive folders cleared"
```

3. Remove Windows/Mac junk files:
```powershell
Get-ChildItem -Recurse -Force -Include "Thumbs.db",".DS_Store","desktop.ini" | Remove-Item -Force; Write-Host "OS junk cleared"
```

4. Remove empty directories in src:
```powershell
Get-ChildItem -Path "src" -Recurse -Directory | Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 } | Remove-Item -Force; Write-Host "Empty dirs cleared"
```
