# NutriTrack 打包腳本 - 生成單一離線 HTML 檔案
# 執行：在此資料夾開啟 PowerShell，輸入  .\build.ps1

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$OUT = Join-Path $DIR "NutriTrack-standalone.html"

Write-Host "NutriTrack 打包中..." -ForegroundColor Cyan

# 讀取本地檔案
$css   = Get-Content (Join-Path $DIR "style.css") -Raw -Encoding UTF8
$dbjs  = Get-Content (Join-Path $DIR "db.js")     -Raw -Encoding UTF8
$appjs = Get-Content (Join-Path $DIR "app.js")    -Raw -Encoding UTF8
$orig  = Get-Content (Join-Path $DIR "index.html") -Raw -Encoding UTF8

# 下載 html5-qrcode
Write-Host "下載 html5-qrcode..." -ForegroundColor Yellow
try {
    $qrcodeJs = (Invoke-WebRequest "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js" -UseBasicParsing).Content
    Write-Host "html5-qrcode 下載成功" -ForegroundColor Green
} catch {
    $qrcodeJs = "/* html5-qrcode 下載失敗，條碼功能需要網路 */"
    Write-Host "警告：html5-qrcode 下載失敗" -ForegroundColor Yellow
}

# Icon 轉 base64
$iconPath = Join-Path $DIR "icon-192.png"
$iconTag  = ""
if (Test-Path $iconPath) {
    $iconB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($iconPath))
    $iconTag  = '<link rel="apple-touch-icon" href="data:image/png;base64,' + $iconB64 + '" />'
    Write-Host "圖示已嵌入" -ForegroundColor Green
}

# 從原始 index.html 擷取 <body> 內容（去掉 head）
# 用正規式抓 <body> 到 </body>
$bodyMatch = [regex]::Match($orig, '(?s)<body>(.*)</body>')
$bodyInner = $bodyMatch.Groups[1].Value

# 移除外部 script 和 link 標籤（由我們內嵌取代）
$bodyInner = [regex]::Replace($bodyInner, '<script src="db\.js"></script>', '')
$bodyInner = [regex]::Replace($bodyInner, '<script src="app\.js"></script>', '')
$bodyInner = [regex]::Replace($bodyInner, '(?s)<script>\s*// Register Service Worker.*?</script>', '')

# 建立 standalone HTML
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('<!DOCTYPE html>')
[void]$sb.AppendLine('<html lang="zh-TW">')
[void]$sb.AppendLine('<head>')
[void]$sb.AppendLine('  <meta charset="UTF-8" />')
[void]$sb.AppendLine('  <meta name="viewport" content="width=device-width, initial-scale=1.0" />')
[void]$sb.AppendLine('  <title>NutriTrack - 智能飲食追蹤系統</title>')
[void]$sb.AppendLine('  <meta name="mobile-web-app-capable" content="yes" />')
[void]$sb.AppendLine('  <meta name="apple-mobile-web-app-capable" content="yes" />')
[void]$sb.AppendLine('  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />')
[void]$sb.AppendLine('  <meta name="apple-mobile-web-app-title" content="NutriTrack" />')
[void]$sb.AppendLine('  <meta name="theme-color" content="#38b2ac" />')
if ($iconTag) { [void]$sb.AppendLine("  $iconTag") }
[void]$sb.AppendLine('  <link rel="preconnect" href="https://fonts.googleapis.com" />')
[void]$sb.AppendLine('  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />')
[void]$sb.AppendLine('  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />')
[void]$sb.AppendLine('  <style>')
[void]$sb.AppendLine($css)
[void]$sb.AppendLine('  </style>')
[void]$sb.AppendLine('  <script>')
[void]$sb.AppendLine($qrcodeJs)
[void]$sb.AppendLine('  </script>')
[void]$sb.AppendLine('</head>')
[void]$sb.AppendLine('<body>')
[void]$sb.AppendLine($bodyInner)
[void]$sb.AppendLine('  <script>')
[void]$sb.AppendLine($dbjs)
[void]$sb.AppendLine($appjs)
[void]$sb.AppendLine('  </script>')
[void]$sb.AppendLine('</body>')
[void]$sb.AppendLine('</html>')

[IO.File]::WriteAllText($OUT, $sb.ToString(), [Text.Encoding]::UTF8)

$sizeKB = [math]::Round((Get-Item $OUT).Length / 1KB)
Write-Host ""
Write-Host "打包完成！" -ForegroundColor Green
Write-Host "檔案路徑：$OUT" -ForegroundColor Cyan
Write-Host "檔案大小：$sizeKB KB" -ForegroundColor Cyan
Write-Host ""
Write-Host "傳到手機方式：LINE / WhatsApp / AirDrop / USB / Email" -ForegroundColor Yellow
Write-Host "Android：用 Chrome 打開 → 完全離線可用" -ForegroundColor Yellow
Write-Host "iOS：用 Safari 打開（條碼掃描需要 https）" -ForegroundColor Yellow
