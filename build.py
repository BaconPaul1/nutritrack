#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NutriTrack 打包腳本 - 生成單一離線 HTML 檔案
執行：python build.py
"""

import os, re, base64, urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DIR, "NutriTrack-standalone.html")

def read(name):
    with open(os.path.join(DIR, name), encoding='utf-8') as f:
        return f.read()

print("[NutriTrack] Bundling...")

css   = read("style.css")
dbjs  = read("db.js")
appjs = read("app.js")
orig  = read("index.html")

# 下載 html5-qrcode
print("[1/3] Downloading html5-qrcode...")
try:
    with urllib.request.urlopen("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js", timeout=30) as r:
        qrcode_js = r.read().decode('utf-8')
    print("  OK: html5-qrcode downloaded")
except Exception as e:
    qrcode_js = f"/* html5-qrcode unavailable: {e} */"
    print(f"  WARN: download failed: {e}")

# Icon 轉 base64
print("[2/3] Embedding icon...")
icon_tag = ""
icon_path = os.path.join(DIR, "icon-192.png")
if os.path.exists(icon_path):
    with open(icon_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    icon_tag = f'<link rel="apple-touch-icon" href="data:image/png;base64,{b64}" />'
    print("  OK: icon embedded")

# 擷取 <body> 內容
body_match = re.search(r'<body>(.*)</body>', orig, re.DOTALL)
body_inner = body_match.group(1) if body_match else orig

# 移除外部 script 標籤（我們改為內嵌）
body_inner = re.sub(r'<script src="db\.js"></script>', '', body_inner)
body_inner = re.sub(r'<script src="app\.js"></script>', '', body_inner)
body_inner = re.sub(r'<script src="https://unpkg[^"]*"></script>', '', body_inner)
body_inner = re.sub(r'<link rel="manifest"[^>]*>', '', body_inner)
body_inner = re.sub(r'(?s)<script>\s*// Register Service Worker.*?</script>', '', body_inner)

fonts_url = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"

html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NutriTrack - 智能飲食追蹤系統</title>
  <meta name="description" content="科學級代謝建模與飲食追蹤平台" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="NutriTrack" />
  <meta name="theme-color" content="#38b2ac" />
  {icon_tag}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="{fonts_url}" rel="stylesheet" />
  <style>
{css}
  </style>
  <script>
{qrcode_js}
  </script>
</head>
<body>
{body_inner}
  <script>
// ===== NutriTrack 食物資料庫 =====
{dbjs}

// ===== NutriTrack 主程式 =====
{appjs}
  </script>
</body>
</html>
"""

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(OUT) // 1024
print("")
print("[DONE] Bundle complete!")
print(f"  File : {OUT}")
print(f"  Size : {size_kb} KB")
print("")
print("  Share via: LINE / WhatsApp / AirDrop / USB")
print("  Android  : open with Chrome - fully offline")
print("  iOS      : open with Safari (camera needs https)")
