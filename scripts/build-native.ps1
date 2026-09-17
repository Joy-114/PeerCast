$ErrorActionPreference='Stop'
$root = Split-Path -Parent $PSScriptRoot
$dotnet = Join-Path $root '.tools/dotnet/dotnet.exe'
if (!(Test-Path $dotnet)) { $dotnet = (Get-Command dotnet -ErrorAction Stop).Source }
& $dotnet publish (Join-Path $root 'native/PeerCast.Audio/PeerCast.Audio.csproj') -c Release -r win-x64 --self-contained true
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
