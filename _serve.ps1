$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Host "Listening on http://localhost:8765/"
$root = $PSScriptRoot
while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request
    $res = $ctx.Response
    $localPath = $req.Url.AbsolutePath
    if ($localPath -eq '/') { $localPath = '/index.html' }
    $rel = $localPath.TrimStart('/').Replace('/', '\')
    $filePath = Join-Path $root $rel
    Write-Host "$($req.HttpMethod) $localPath -> $filePath"
    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.js'   { 'application/javascript; charset=utf-8' }
            '.json' { 'application/json; charset=utf-8' }
            '.webmanifest' { 'application/manifest+json; charset=utf-8' }
            '.png'  { 'image/png' }
            '.webp' { 'image/webp' }
            '.ico'  { 'image/x-icon' }
            '.woff' { 'font/woff' }
            '.woff2'{ 'font/woff2' }
            '.svg'  { 'image/svg+xml' }
            default { 'application/octet-stream' }
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentType = $mime
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
    }
    $res.Close()
}
