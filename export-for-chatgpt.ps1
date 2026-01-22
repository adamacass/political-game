# export-for-chatgpt.ps1
# Minimal exporter for review: copies only text/code/config files and zips them.
# Output:
#   SUMMARY_FOR_CHAT.txt
#   _chatgpt_export\export\...
#   _chatgpt_export\meta\...
#   _chatgpt_export.zip

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\political-game"
if (!(Test-Path -LiteralPath $Root)) { throw "Root folder not found: $Root" }
$Root = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')

$OutDir    = Join-Path $Root "_chatgpt_export"
$ExportDir = Join-Path $OutDir "export"
$MetaDir   = Join-Path $OutDir "meta"

$SummaryPath  = Join-Path $Root "SUMMARY_FOR_CHAT.txt"
$TreePath     = Join-Path $MetaDir "tree.txt"
$ManifestPath = Join-Path $MetaDir "manifest.csv"
$SkippedPath  = Join-Path $MetaDir "skipped_files.txt"
$ZipPath      = Join-Path $Root "_chatgpt_export.zip"

$MaxFileKB = 800

$ExcludeDirNames = @(
  ".git",".svn",".hg",
  "node_modules",
  "_chatgpt_export",
  "dist","build","out",".next",".nuxt",
  ".svelte-kit",".vercel",".netlify",
  "coverage",".turbo",".cache",".parcel-cache",
  ".idea",".vscode",
  "__pycache__", ".pytest_cache",
  ".terraform",".serverless",
  "target","bin","obj"
)

$IncludeExt = @(
  ".ts",".tsx",".js",".jsx",".mjs",".cjs",
  ".json",".jsonc",
  ".yml",".yaml",
  ".md",".txt",
  ".env",".example",
  ".html",".css",".scss",
  ".sql",".prisma",
  ".toml",".ini",".conf",
  ".sh",".ps1",".bat"
)

$IncludeNames = @(
  "package.json","package-lock.json","pnpm-lock.yaml","yarn.lock",
  "tsconfig.json","jsconfig.json",
  "vite.config.ts","vite.config.js",
  "next.config.js","next.config.mjs",
  "tailwind.config.js","tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.js",".eslintrc",".eslintrc.json",".eslintrc.js",
  ".prettierrc",".prettierrc.json",".prettierrc.js","prettier.config.js",
  "README.md","LICENSE","Dockerfile","docker-compose.yml",
  "vercel.json","netlify.toml","render.yaml","fly.toml"
)

function Ensure-Dir([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Get-RelPath([string]$Base, [string]$Full) {
  $b = (Resolve-Path -LiteralPath $Base).Path.TrimEnd('\') + '\'
  $f = (Resolve-Path -LiteralPath $Full).Path
  if ($f.StartsWith($b, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $f.Substring($b.Length)
  }
  return $f
}

function Is-Excluded([string]$FullPath) {
  # exclude if any directory segment matches excluded list
  $rel = Get-RelPath $Root $FullPath
  $parts = $rel -split '\\'
  foreach ($p in $parts) {
    if ($ExcludeDirNames -contains $p) { return $true }
  }
  return $false
}

# Clean outputs
if (Test-Path -LiteralPath $OutDir) { Remove-Item -LiteralPath $OutDir -Recurse -Force }
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
if (Test-Path -LiteralPath $SummaryPath) { Remove-Item -LiteralPath $SummaryPath -Force }

Ensure-Dir $OutDir
Ensure-Dir $ExportDir
Ensure-Dir $MetaDir

# Build tree (depth-limited)
$MaxTreeDepth = 6
$tree = New-Object System.Collections.Generic.List[string]
$tree.Add("ROOT: $Root")
$tree.Add("")
Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
  if (Is-Excluded $_.FullName) { return }
  $rel = Get-RelPath $Root $_.FullName
  $depth = ($rel -split '\\').Count - 1
  if ($depth -gt $MaxTreeDepth) { return }
  if ($_.PSIsContainer) {
    $tree.Add(("{0}{1}\" -f ("  " * $depth), (Split-Path $rel -Leaf)))
  } else {
    $kb = [Math]::Round($_.Length / 1KB, 1)
    $tree.Add(("{0}{1} ({2} KB)" -f ("  " * $depth), (Split-Path $rel -Leaf), $kb))
  }
}
$tree | Set-Content -LiteralPath $TreePath -Encoding UTF8

# Select files
$skipped = New-Object System.Collections.Generic.List[string]
$selected = New-Object System.Collections.Generic.List[System.IO.FileInfo]

Get-ChildItem -LiteralPath $Root -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
  if (Is-Excluded $_.FullName) { return }

  $name = $_.Name
  $ext  = [IO.Path]::GetExtension($name).ToLowerInvariant()
  $sizeKB = [Math]::Round($_.Length / 1KB, 1)

  # skip obvious binaries
  if ($ext -in @(".png",".jpg",".jpeg",".gif",".webp",".ico",".pdf",".zip",".7z",".rar",".exe",".dll",".bin",".mp4",".mov",".wav",".mp3")) {
    $skipped.Add("SKIP(binary ext) $(Get-RelPath $Root $_.FullName)")
    return
  }

  $byExt  = $IncludeExt -contains $ext
  $byName = $IncludeNames -contains $name
  if ($name -match '^\.env(\..+)?$') { $byName = $true }

  if (!($byExt -or $byName)) { return }

  if ($sizeKB -gt $MaxFileKB) {
    $skipped.Add("SKIP(too large ${sizeKB}KB) $(Get-RelPath $Root $_.FullName)")
    return
  }

  $selected.Add($_) | Out-Null
}

# Export + manifest
"rel_path,size_bytes,size_kb,sha256" | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
$exportedCount = 0

foreach ($f in $selected) {
  $rel = Get-RelPath $Root $f.FullName
  $dest = Join-Path $ExportDir $rel
  Ensure-Dir (Split-Path $dest -Parent)

  Copy-Item -LiteralPath $f.FullName -Destination $dest -Force

  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $f.FullName).Hash
  $sizeKB = [Math]::Round($f.Length / 1KB, 1)
  "{0},{1},{2},{3}" -f $rel,$f.Length,$sizeKB,$hash | Add-Content -LiteralPath $ManifestPath -Encoding UTF8
  $exportedCount++
}

$skipped | Set-Content -LiteralPath $SkippedPath -Encoding UTF8

# Summary
$extGroups = $selected | Group-Object { [IO.Path]::GetExtension($_.Name).ToLowerInvariant() } | Sort-Object Count -Descending
$topFiles  = $selected | Sort-Object Length -Descending | Select-Object -First 30

$summary = New-Object System.Collections.Generic.List[string]
$summary.Add("PROJECT EXPORT SUMMARY (paste this entire file into chat)")
$summary.Add("Root: $Root")
$summary.Add("Export folder: $OutDir")
$summary.Add("Exported files: $exportedCount")
$summary.Add("Skipped files: $($skipped.Count) (see $SkippedPath)")
$summary.Add("Max exported file size: $MaxFileKB KB")
$summary.Add("")
$summary.Add("==== TREE (depth-limited) ====")
$summary.Add((Get-Content -LiteralPath $TreePath -Raw))
$summary.Add("")
$summary.Add("==== FILE TYPE COUNTS (selected set) ====")
foreach ($g in $extGroups) {
  $extName = if ([string]::IsNullOrWhiteSpace($g.Name)) { "(no ext)" } else { $g.Name }
  $summary.Add(("{0,6}  {1}" -f $g.Count, $extName))
}
$summary.Add("")
$summary.Add("==== TOP 30 LARGEST SELECTED FILES ====")
foreach ($f in $topFiles) {
  $rel = Get-RelPath $Root $f.FullName
  $kb = [Math]::Round($f.Length / 1KB, 1)
  $summary.Add(("{0,8} KB  {1}" -f $kb, $rel))
}
$summary.Add("")
$summary.Add("==== WHAT TO SHARE HERE ====")
$summary.Add("1) Paste SUMMARY_FOR_CHAT.txt into chat.")
$summary.Add("2) Upload _chatgpt_export.zip (created in root).")
$summary.Add("")
$summary.Add("Manifest: $ManifestPath")
$summary.Add("Skipped:  $SkippedPath")

$summary | Set-Content -LiteralPath $SummaryPath -Encoding UTF8

# Zip for upload
Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $ZipPath -Force

Write-Host "DONE"
Write-Host "Summary: $SummaryPath"
Write-Host "Zip:     $ZipPath"
Write-Host "Folder:  $OutDir"
