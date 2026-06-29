$port = if ($args[0]) { $args[0] } else { "5173" }
$root = if ($args[1]) { $args[1] } else { $PSScriptRoot }

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.css'  = 'text/css'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
    '.txt'  = 'text/plain'
    '.webmanifest' = 'application/manifest+json'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $urlPath = $req.Url.LocalPath.TrimStart('/')
    if ($urlPath -eq '') { $urlPath = 'index.html' }
    $urlPath = $urlPath -replace '\.\.[\\/]', ''
    $file = Join-Path $root $urlPath

    if (Test-Path $file -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentLength64 = $bytes.Length
        $res.StatusCode = 200
        try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } catch {}
    } else {
        $res.StatusCode = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $res.ContentLength64 = $body.Length
        try { $res.OutputStream.Write($body, 0, $body.Length) } catch {}
    }
    try { $res.OutputStream.Close() } catch {}
}
