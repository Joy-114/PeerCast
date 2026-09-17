param([int]$Frequency=440)
Add-Type -AssemblyName System
$rate=48000;$frames=48000
$memory=New-Object System.IO.MemoryStream
$writer=New-Object System.IO.BinaryWriter $memory
$writer.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'));$writer.Write([int](36+$frames*4));$writer.Write([System.Text.Encoding]::ASCII.GetBytes('WAVEfmt '));$writer.Write([int]16);$writer.Write([int16]1);$writer.Write([int16]2);$writer.Write([int]$rate);$writer.Write([int]($rate*4));$writer.Write([int16]4);$writer.Write([int16]16);$writer.Write([System.Text.Encoding]::ASCII.GetBytes('data'));$writer.Write([int]($frames*4))
for($i=0;$i -lt $frames;$i++){ $sample=[int16](1200*[Math]::Sin(2*[Math]::PI*$Frequency*$i/$rate));$writer.Write($sample);$writer.Write($sample) }
$memory.Position=0
$player=New-Object System.Media.SoundPlayer $memory
$player.PlayLooping()
[Console]::WriteLine('ready')
[Console]::ReadLine() | Out-Null
$player.Stop();$player.Dispose();$writer.Dispose();$memory.Dispose()
