# server.ps1 - Servidor local con Socket TCP (NO requiere permisos de Administrador)
$port = 8080
$folder = $PSScriptRoot
$ip = [System.Net.IPAddress]::Loopback
$listener = New-Object System.Net.Sockets.TcpListener($ip, $port)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  YONKE POS - SERVIDOR LOCAL SOLO EN ESTE EQUIPO          " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Abre la aplicacion en este equipo:"
    Write-Host ""
    Write-Host "  --> http://127.0.0.1:$port/ " -ForegroundColor Yellow
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
                $filePath = $null
                if ($tokens[0] -eq "GET") {
                    try {
                        $rawPath = [System.Uri]::UnescapeDataString($tokens[1].Split('?')[0]).TrimStart('/')
                        if ([string]::IsNullOrEmpty($rawPath)) { $rawPath = "index.html" }
                        if (-not [System.IO.Path]::IsPathRooted($rawPath) -and $rawPath -notmatch '(^|[\\/])\.\.([\\/]|$)') {
                            $rootPath = [System.IO.Path]::GetFullPath($folder).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
                            $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $folder $rawPath))
                            if ($candidatePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                                $filePath = $candidatePath
                            }
                        }
                    } catch {
                        $filePath = $null
                    }
                }

                if ($filePath -and (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $mime = "text/html"
                    if ($ext -eq ".js") { $mime = "application/javascript" }
                    elseif ($ext -eq ".css") { $mime = "text/css" }
                    elseif ($ext -eq ".json") { $mime = "application/json" }
                    elseif ($ext -eq ".png") { $mime = "image/png" }
                    elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $mime = "image/jpeg" }

                    $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n`r`n"
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
