# server.ps1 - Servidor local con Socket TCP (NO requiere permisos de Administrador)
$port = 8080
$folder = $PSScriptRoot
$ip = [System.Net.IPAddress]::Any
$listener = New-Object System.Net.Sockets.TcpListener($ip, $port)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  YONKE POS - SERVIDOR LOCAL PARA CELULARES ACTIVO        " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Abre en el navegador de tu celular (conectado al mismo WiFi):"
    Write-Host ""
    Write-Host "  --> http://192.168.100.20:$port/ " -ForegroundColor Yellow
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Manten esta ventana abierta mientras uses la app en tu celular."
    Write-Host "Presiona Ctrl+C para cerrarla cuando termines."
    Write-Host ""

    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        
        $line = $reader.ReadLine()
        if ($line) {
            $tokens = $line.Split(' ')
            if ($tokens.Length -ge 2) {
                $rawPath = $tokens[1].Split('?')[0].TrimStart('/')
                if ([string]::IsNullOrEmpty($rawPath)) { $rawPath = "index.html" }
                $filePath = Join-Path $folder $rawPath

                if (Test-Path $filePath -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $mime = "text/html"
                    if ($ext -eq ".js") { $mime = "application/javascript" }
                    elseif ($ext -eq ".css") { $mime = "text/css" }
                    elseif ($ext -eq ".json") { $mime = "application/json" }
                    elseif ($ext -eq ".png") { $mime = "image/png" }
                    elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }

                    $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                } else {
                    $notFound = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
                    $notFoundBytes = [System.Text.Encoding]::ASCII.GetBytes($notFound)
                    $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
                }
            }
        }
        $stream.Close()
        $client.Close()
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    $listener.Stop()
}
